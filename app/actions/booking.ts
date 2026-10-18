"use server"

import { headers } from "next/headers"
import { getUpcomingBlockedDates } from "@/lib/blocked-dates"
import { isInCoverage } from "@/lib/coverage"
import { normalizeWhatsapp, resolveSource, toArgentinaTimestamp } from "@/lib/booking"
import { EXTRAS, TIME_SLOTS, VEHICLES } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"

export type BookingResult = { ok: true } | { ok: false; error: string; field?: string }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MIN_FILL_MS = 3000

function text(data: FormData, key: string, max: number) {
  return String(data.get(key) ?? "")
    .trim()
    .slice(0, max)
}

const MAX_VEHICLES = 10

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type VehicleInput = { category: string; brand: string; model: string; catalog_id: string | null }

function parseVehicles(raw: string): VehicleInput[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_VEHICLES) return null
  const vehicles: VehicleInput[] = []
  for (const item of parsed) {
    if (!item || typeof item !== "object") return null
    const { category, brand, model, catalog_id } = item as Record<string, unknown>
    if (typeof category !== "string" || !VEHICLES.some((v) => v.id === category)) return null
    vehicles.push({
      category,
      catalog_id: typeof catalog_id === "string" && UUID_RE.test(catalog_id) ? catalog_id : null,
      brand: typeof brand === "string" ? brand.trim().slice(0, 60) : "",
      model: typeof model === "string" ? model.trim().slice(0, 60) : "",
    })
  }
  return vehicles
}

export async function submitBooking(data: FormData): Promise<BookingResult> {
  if (text(data, "website", 200)) return { ok: true }
  const startedAt = Number(data.get("startedAt"))
  if (!startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    return { ok: false, error: "Revisá los datos y volvé a intentar en unos segundos." }
  }

  const fullName = text(data, "name", 120)
  const whatsapp = normalizeWhatsapp(text(data, "phone", 30))
  const email = text(data, "email", 160).toLowerCase()
  const vehicles = parseVehicles(String(data.get("vehicles") ?? ""))
  const address = text(data, "address", 200)
  const date = text(data, "date", 10)
  const time = text(data, "time", 5)
  const notes = text(data, "notes", 1000)
  const waterSupply = data.get("noWater") ? "propia" : "domicilio"
  const extras = data
    .getAll("extras")
    .map(String)
    .filter((id) => EXTRAS.some((e) => e.id === id))

  if (fullName.length < 3 || !fullName.includes(" ")) {
    return { ok: false, field: "name", error: "Ingresá tu nombre y apellido." }
  }
  if (!whatsapp) return { ok: false, field: "phone", error: "Ingresá un WhatsApp válido con código de área." }
  if (email && !EMAIL_RE.test(email)) return { ok: false, field: "email", error: "Ingresá un correo electrónico válido." }
  if (!vehicles) return { ok: false, field: "vehicle", error: "Elegí el tipo de cada vehículo." }
  if (address.length < 5) return { ok: false, field: "address", error: "Ingresá la dirección del lavado." }
  const lat = text(data, "lat", 20)
  const lng = text(data, "lng", 20)
  if (lat && lng && !isInCoverage(Number(lat), Number(lng))) {
    return {
      ok: false,
      field: "address",
      error: "La dirección está fuera de nuestra zona de cobertura. Escribinos por WhatsApp y lo vemos.",
    }
  }
  const latNum = Number(lat)
  const lngNum = Number(lng)
  const mapLink =
    lat && lng && Number.isFinite(latNum) && Number.isFinite(lngNum)
      ? `https://www.google.com/maps?q=${latNum.toFixed(6)},${lngNum.toFixed(6)}`
      : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !TIME_SLOTS.includes(time)) {
    return { ok: false, field: "date", error: "Elegí fecha y horario." }
  }
  const requestedStart = toArgentinaTimestamp(date, time)
  const requested = new Date(requestedStart)
  if (Number.isNaN(requested.getTime()) || requested.getTime() < Date.now()) {
    return { ok: false, field: "date", error: "Elegí una fecha y horario futuros." }
  }
  if (requested.getUTCDay() === 0 && requested.getUTCHours() >= 3) {
    return { ok: false, field: "date", error: "Trabajamos de lunes a sábado. Elegí otro día." }
  }
  const blocked = (await getUpcomingBlockedDates(date)).find((b) => b.day === date)
  if (blocked) {
    return { ok: false, field: "date", error: "Ese día no tenemos turnos disponibles. Elegí otra fecha." }
  }

  const supabase = await createClient()
  if (!supabase) {
    return {
      ok: false,
      error: "El sistema de reservas no está disponible en este momento. Escribinos por WhatsApp.",
    }
  }

  const headerList = await headers()
  const source = resolveSource({
    utmSource: text(data, "utmSource", 40),
    ref: text(data, "ref", 40),
    referrer: text(data, "referrer", 300) || headerList.get("referer"),
  })

  const service =
    vehicles.length === 1
      ? `Lavado a domicilio · ${VEHICLES.find((v) => v.id === vehicles[0].category)?.name}`
      : `Lavado a domicilio · ${vehicles.length} vehículos`
  const { error } = await supabase.rpc("submit_booking", {
    payload: {
      full_name: fullName,
      whatsapp,
      email,
      vehicles,
      address,
      requested_start: requestedStart,
      service,
      extras,
      water_supply: waterSupply,
      notes: mapLink ? [notes, `Ubicación en mapa: ${mapLink}`].filter(Boolean).join("\n") : notes,
      source,
      origen_reserva: data.get("origen") === "whatsapp_flyer" ? "whatsapp_flyer" : "web",
      marketing_consent: data.get("marketing") === "on",
    },
  })

  if (error) {
    console.error("[booking] submit_booking failed:", error.code, error.message)
    if (error.code === "P0002") {
      return { ok: false, error: "Ya recibimos varias solicitudes tuyas. Te vamos a contactar a la brevedad." }
    }
    return { ok: false, error: "No pudimos guardar tu solicitud. Volvé a intentar." }
  }

  return { ok: true }
}
