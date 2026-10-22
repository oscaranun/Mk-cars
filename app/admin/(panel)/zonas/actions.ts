"use server"

import { revalidatePath } from "next/cache"
import { getAdminClient } from "@/lib/admin/auth"
import { isValidDate } from "@/lib/admin/format"
import { parseRing } from "@/lib/zones/geometry"
import type { ActionState } from "@/app/admin/(panel)/crm-actions"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim()
const failure = (message: string): ActionState => ({ ok: false, message })

export async function configureZones(_prev: ActionState, data: FormData): Promise<ActionState> {
  const client = await getAdminClient()
  if (!client) return failure("Sesión vencida o sin permisos de administrador.")
  const kind = text(data, "kind")
  let payload: Record<string, unknown>
  if (kind === "zone") {
    const id = text(data, "id"),
      name = text(data, "name"),
      raw = text(data, "polygon"),
      active = data.get("active") === "on"
    const polygon = raw ? parseRing(raw) : null
    if ((id && !uuid.test(id)) || name.length < 2 || name.length > 100)
      return failure("Nombre o identificador de zona inválido.")
    if ((raw && !polygon) || (active && !polygon))
      return failure("Marcá al menos tres puntos para definir un límite válido en el mapa antes de activar la zona.")
    const priority = Number(text(data, "priority"))
    if (!Number.isInteger(priority) || Math.abs(priority) > 10000) return failure("Prioridad inválida.")
    payload = {
      id: id || null,
      name,
      neighborhoods: text(data, "neighborhoods")
        .split(/[,\n]/)
        .map((n) => n.trim())
        .filter(Boolean)
        .slice(0, 100),
      polygon,
      priority,
      active,
    }
  } else if (kind === "weekly" || kind === "override") {
    const zone_ids = data.getAll("zone_ids").map(String)
    const capacity = Number(text(data, "capacity")),
      weekday = Number(text(data, "weekday")),
      day = text(data, "day")
    if (zone_ids.some((id) => !uuid.test(id)) || !Number.isInteger(capacity) || capacity < 1 || capacity > 30)
      return failure("Zonas o cupos inválidos.")
    if (kind === "weekly" && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6))
      return failure("Día de semana inválido.")
    if (kind === "override" && !isValidDate(day)) return failure("Fecha inválida.")
    payload = {
      zone_ids,
      capacity,
      weekday,
      day,
      flexible: data.get("flexible") === "on",
      enabled: data.get("enabled") === "on",
      reason: text(data, "reason").slice(0, 200),
    }
  } else if (kind === "copy") {
    const source = text(data, "source"),
      target = text(data, "target")
    if (!isValidDate(target) || (source && !isValidDate(source)))
      return failure("Indicá fechas válidas para copiar los siete días.")
    payload = { source: source || null, target }
  } else if (kind === "settings") {
    if (data.get("enabled") === "on" && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
      return failure(
        "Antes de activar, configurá la clave existente de Google Maps en este entorno. No se cambió la modalidad.",
      )
    const minutes = Number(text(data, "minutes_per_vehicle")),
      horizon = Number(text(data, "horizon_days"))
    if (
      !Number.isInteger(minutes) ||
      minutes < 15 ||
      minutes > 540 ||
      !Number.isInteger(horizon) ||
      horizon < 7 ||
      horizon > 90
    )
      return failure("Duración u horizonte inválidos.")
    const dayStart = text(data, "day_start"),
      dayEnd = text(data, "day_end"),
      pauseStart = text(data, "pause_start"),
      pauseEnd = text(data, "pause_end")
    const travel = Number(text(data, "travel_minutes")),
      buffer = Number(text(data, "buffer_minutes"))
    const time = /^([01]\d|2[0-3]):[0-5]\d$/
    if (
      !time.test(dayStart) ||
      !time.test(dayEnd) ||
      dayStart >= dayEnd ||
      !Number.isInteger(travel) ||
      travel < 0 ||
      travel > 240 ||
      !Number.isInteger(buffer) ||
      buffer < 0 ||
      buffer > 120
    )
      return failure("Revisá la jornada, el traslado y el margen.")
    if (
      (pauseStart || pauseEnd) &&
      (!time.test(pauseStart) ||
        !time.test(pauseEnd) ||
        pauseStart < dayStart ||
        pauseStart >= pauseEnd ||
        pauseEnd > dayEnd)
    )
      return failure("La pausa debe estar completa y dentro de la jornada.")
    payload = {
      enabled: data.get("enabled") === "on",
      minutes_per_vehicle: minutes,
      horizon_days: horizon,
      day_start: dayStart,
      day_end: dayEnd,
      travel_minutes: travel,
      buffer_minutes: buffer,
      pause_start: pauseStart || null,
      pause_end: pauseEnd || null,
    }
  } else if (kind === "unit" || kind === "service") {
    const id = text(data, "id"),
      name = text(data, "name")
    if ((id && !uuid.test(id)) || name.length < 2 || name.length > 100)
      return failure("Nombre o identificador inválido.")
    payload = { id: id || null, name, active: data.get("active") === "on" }
    if (kind === "service") {
      const minutes = Number(text(data, "minutes_per_vehicle"))
      if (!Number.isInteger(minutes) || minutes < 15 || minutes > 540)
        return failure("La duración debe estar entre 15 y 540 minutos.")
      payload.minutes_per_vehicle = minutes
    }
  } else return failure("Acción inválida.")
  const { error } = await client.rpc("configure_zone_booking", { p_kind: kind, p_data: payload })
  if (error)
    return failure(
      ["P0001", "22023"].includes(error.code)
        ? error.message
        : "No se pudo guardar. Verificá la migración y los permisos.",
    )
  revalidatePath("/admin", "layout")
  revalidatePath("/")
  revalidatePath("/reservar")
  return {
    ok: true,
    message: "Guardado. Las reservas existentes se conservan; revisá los recorridos afectados en la agenda.",
  }
}

export async function manageZoneRequest(_prev: ActionState, data: FormData): Promise<ActionState> {
  const client = await getAdminClient()
  if (!client) return failure("Sesión vencida o sin permisos de administrador.")
  const id = text(data, "id"),
    action = text(data, "action")
  if (!uuid.test(id) || !["propose", "client_accepted", "client_rejected", "cancel"].includes(action))
    return failure("Solicitud o acción inválida.")
  const day = text(data, "date"),
    time = text(data, "time"),
    duration = Number(text(data, "duration")),
    rawPrice = text(data, "price").replace(",", ".")
  const price = rawPrice ? Number(rawPrice) : null
  const unit = text(data, "mobile_unit_id")
  if (unit && !uuid.test(unit)) return failure("Unidad móvil inválida.")
  if (
    action === "propose" &&
    (!isValidDate(day) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !Number.isInteger(duration) ||
      duration < 15 ||
      duration > 540 ||
      (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000000)))
  )
    return failure("Revisá fecha, hora, duración y precio.")
  const { error } = await client.rpc("manage_zone_request", {
    p_id: id,
    p_action: action,
    p_start: action === "propose" ? `${day}T${time}:00-03:00` : null,
    p_duration: action === "propose" ? duration : null,
    p_price: action === "propose" ? price : null,
    p_reason: text(data, "reason").slice(0, 200) || null,
    p_unit: unit || null,
  })
  if (error)
    return failure(
      ["P0001", "22023", "P0002"].includes(error.code)
        ? error.message
        : "No se pudo actualizar. No se confirmó ningún cambio.",
    )
  revalidatePath("/admin", "layout")
  return {
    ok: true,
    message:
      action === "propose"
        ? "Propuesta guardada. Enviá el mensaje y registrá la respuesta; todavía no está confirmado."
        : "Estado actualizado.",
  }
}

export async function assignAppointmentUnit(_prev: ActionState, data: FormData): Promise<ActionState> {
  const client = await getAdminClient()
  if (!client) return failure("Sesión vencida o sin permisos.")
  const id = text(data, "id"),
    unit = text(data, "mobile_unit_id")
  if (!uuid.test(id) || !uuid.test(unit)) return failure("Turno o unidad inválidos.")
  const { error } = await client.rpc("zone_assign_unit", { p_id: id, p_unit: unit })
  if (error) return failure(error.code === "P0001" ? error.message : "No se pudo reasignar la unidad.")
  revalidatePath("/admin", "layout")
  return { ok: true, message: "Unidad reasignada con registro en el historial." }
}
