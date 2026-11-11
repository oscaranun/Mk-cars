"use server"

import { randomUUID } from "node:crypto"
import { parseMoney } from "@/lib/admin/money"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { PostgrestError } from "@supabase/supabase-js"
import type { ActionState } from "@/app/admin/(panel)/crm-actions"
import { getAdminClient } from "@/lib/admin/auth"
import { isValidDate, isValidTime } from "@/lib/admin/format"
import { normalizeWhatsapp, toArgentinaTimestamp } from "@/lib/booking"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MANUAL_SOURCES = ["whatsapp", "telefono", "instagram", "presencial", "otro"]

const fail = (message: string): ActionState => ({ ok: false, message })
const text = (data: FormData, key: string, max = 500) => String(data.get(key) ?? "").trim().slice(0, max)

function done(id: string | null, message: string): ActionState {
  if (id) revalidatePath(`/admin/turnos/${id}`)
  revalidatePath("/admin", "layout")
  return { ok: true, message }
}

function amount(data: FormData, key: string): number | null | "invalid" {
  const raw = text(data, key, 30)
  if (!raw) return null
  return parseMoney(raw) ?? "invalid"
}

function dbError(error: PostgrestError, fallback: string): ActionState {
  console.error("[offers] db error:", error.code, error.message)
  if (error.code === "P0001" || error.code === "22023") return fail(error.message)
  if (error.code === "23505") return fail("Ese registro ya existe.")
  if (error.code === "42501") return fail("No tenés permisos para esta acción.")
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42P01")
    return fail("Falta instalar la actualización requerida (026 para la carga histórica) en esta base.")
  return fail(fallback)
}

function appointmentId(data: FormData) {
  const id = text(data, "appointment_id", 36)
  return UUID_RE.test(id) ? id : null
}

export async function saveOffer(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const id = appointmentId(data)
  if (!id) return fail("Turno inválido.")

  const dates = data.getAll("slot_date").map(String)
  const times = data.getAll("slot_time").map(String)
  const durations = data.getAll("slot_duration").map(String)
  const slots: { start: string; duration: number }[] = []
  for (let i = 0; i < dates.length; i++) {
    if (!dates[i] && !times[i]) continue
    if (!isValidDate(dates[i]) || !isValidTime(times[i])) return fail(`Revisá la fecha y hora de la opción ${i + 1}.`)
    const duration = Number(durations[i])
    if (!Number.isInteger(duration) || duration < 15 || duration > 540) return fail(`Revisá la duración de la opción ${i + 1}.`)
    slots.push({ start: toArgentinaTimestamp(dates[i], times[i]), duration })
  }
  if (!slots.length) return fail("Ofrecé al menos un horario.")
  if (slots.length > 6) return fail("Ofrecé como máximo 6 horarios.")

  const total = amount(data, "total")
  const discount = amount(data, "discount")
  if (total === null || total === "invalid") return fail("Ingresá el importe del servicio.")
  if (discount === "invalid") return fail("Revisá el descuento.")
  if ((discount ?? 0) > total) return fail("El descuento no puede superar el importe.")

  const { error } = await supabase.rpc("save_appointment_offer", {
    p_appointment_id: id,
    p_slots: slots,
    p_total: total,
    p_discount: discount ?? 0,
    p_conditions: text(data, "conditions", 2000),
    p_service: text(data, "service", 200),
  })
  if (error) return dbError(error, "No se pudo guardar la propuesta.")
  return done(id, "Propuesta guardada. El enlace del cliente ya muestra estas condiciones.")
}

export async function reopenOffer(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const id = appointmentId(data)
  if (!id) return fail("Turno inválido.")
  const { error } = await supabase.rpc("reopen_appointment_offer", { p_appointment_id: id, p_reason: text(data, "reason", 300) })
  if (error) return dbError(error, "No se pudo reabrir la propuesta.")
  return done(id, "Propuesta reabierta. Editala y el cliente tendrá que aceptarla de nuevo con el mismo enlace.")
}

export async function addAppointmentNote(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const id = appointmentId(data)
  if (!id) return fail("Turno inválido.")
  const body = text(data, "body", 4000)
  if (!body) return fail("Escribí la nota.")
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const { error } = await supabase.from("appointment_notes").insert({ appointment_id: id, body, author_id: user.id })
  if (error) return dbError(error, "No se pudo guardar la nota.")
  return done(id, "Nota guardada.")
}

export async function recordTransferPayment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const id = appointmentId(data)
  if (!id) return fail("Turno inválido.")
  const requestId = text(data, "request_id", 36)
  if (!UUID_RE.test(requestId)) return fail("Recargá la página y volvé a intentar.")
  if (data.get("verified") !== "on") return fail("Confirmá que verificaste la transferencia en la cuenta.")
  const value = amount(data, "amount")
  if (value === null || value === "invalid" || value <= 0) return fail("Ingresá el importe recibido.")
  const date = text(data, "date", 10)
  const time = text(data, "time", 5) || "12:00"
  if (!isValidDate(date) || !isValidTime(time)) return fail("Revisá la fecha de la transferencia.")
  const reference = text(data, "reference", 80)
  if (reference && reference.length < 3) return fail("El número de operación debe tener al menos 3 caracteres.")

  const { error } = await supabase.rpc("record_transfer_payment", {
    p_appointment_id: id,
    p_amount: value,
    p_paid_at: toArgentinaTimestamp(date, time),
    p_reference: reference,
    p_notes: text(data, "notes", 300),
    p_request_id: requestId,
    p_verified: true,
  })
  if (error) return dbError(error, "No se pudo registrar el pago.")
  revalidatePath("/admin/caja")
  revalidatePath("/admin/cobros")
  return done(id, "Pago registrado. Ya figura en ingresos.")
}

export async function voidTransferPayment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const id = appointmentId(data)
  const paymentId = text(data, "payment_id", 36)
  if (!id || !UUID_RE.test(paymentId)) return fail("Pago inválido.")
  const reason = text(data, "reason", 300)
  if (reason.length < 3) return fail("Indicá el motivo de la anulación.")
  const { error } = await supabase.rpc("void_payment", { p_id: paymentId, p_reason: reason })
  if (error) return dbError(error, "No se pudo anular el pago.")
  revalidatePath("/admin/caja")
  revalidatePath("/admin/cobros")
  return done(id, "Pago anulado. Queda en el historial y deja de sumar como ingreso.")
}

export async function createManualAppointment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const whatsapp = normalizeWhatsapp(text(data, "whatsapp", 30))
  if (!whatsapp) return fail("Ingresá un WhatsApp válido con código de país y área.")
  const source = text(data, "source", 20)
  if (!MANUAL_SOURCES.includes(source)) return fail("Elegí el origen del pedido.")
  const price = amount(data, "price")
  if (price === "invalid") return fail("Revisá el precio.")
  const duration = Number(text(data, "duration", 4))
  if (!Number.isInteger(duration) || duration < 15 || duration > 540) {
    return fail("Indicá una duración estimada válida (entre 15 y 540 minutos).")
  }

  if (data.get("ignore_duplicate") !== "on") {
    const { data: existing } = await supabase
      .from("appointments")
      .select("id, status, confirmed_start, requested_start, clients!inner(whatsapp)")
      .eq("clients.whatsapp", whatsapp)
      .in("status", ["solicitado", "reprogramado", "esperando_cliente", "confirmado"])
      .limit(1)
    if (existing && existing.length > 0) {
      return fail(
        "Este cliente ya tiene un turno activo. Revisalo en el Tablero antes de crear otro, o marcá “Crear igual” si es un turno distinto.",
      )
    }
  }

  const { data: id, error } = await supabase.rpc("admin_create_appointment", {
    p: {
      duration: String(duration),
      full_name: text(data, "full_name", 120),
      whatsapp,
  vehicle_id: /^[0-9a-f-]{36}$/i.test(text(data, "vehicle_id", 36)) ? text(data, "vehicle_id", 36) : "",
  vehicle_category: text(data, "vehicle_category", 20),
  brand: text(data, "brand", 60),
  model: text(data, "model", 60),
  address: text(data, "address", 200),
  neighborhood: text(data, "neighborhood", 120),
  service: text(data, "service", 200),
      price: price ?? "",
      water_supply: data.get("no_water") === "on" ? "propia" : "domicilio",
      source,
      notes: text(data, "client_notes", 1000),
      internal_note: text(data, "internal_note", 4000),
    },
  })
  if (error) return dbError(error, "No se pudo crear el turno.")
  revalidatePath("/admin", "layout")
  const returnClient = text(data, "return_client_id", 36)
  if (UUID_RE.test(returnClient)) redirect(`/admin/clientes/${returnClient}#turnos`)
  redirect(`/admin/turnos/${id}?creado=1`)
}

export async function registerCompletedService(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const whatsapp = normalizeWhatsapp(text(data, "whatsapp", 30))
  if (!whatsapp) return fail("Ingresá un WhatsApp válido con código de país y área.")
  const source = text(data, "source", 20)
  if (!MANUAL_SOURCES.includes(source)) return fail("Elegí el origen del pedido.")
  const date = text(data, "date", 10)
  const time = text(data, "time", 5)
  if (!isValidDate(date) || !isValidTime(time)) return fail("Revisá la fecha y la hora del lavado.")
  const price = amount(data, "final_price")
  if (price === "invalid" || price === null) return fail("Ingresá el importe del servicio.")
  const paid = amount(data, "amount_paid")
  if (paid === "invalid") return fail("Revisá el importe cobrado.")

  const paymentDateTime = text(data, "paid_at", 25)
  const [paymentDate, paymentTime] = paymentDateTime.split("T")
  if ((paid ?? 0) > 0 && (!isValidDate(paymentDate ?? "") || !isValidTime(paymentTime ?? ""))) return fail("Indicá la fecha y hora real del cobro.")
  const requestId = text(data, "request_id", 36)
  if (!UUID_RE.test(requestId)) return fail("Reabrí el formulario para generar una carga nueva.")
  const { data: id, error } = await supabase.rpc("admin_register_demand_service", {
    p: {
      request_id: requestId,
      client_id: UUID_RE.test(text(data, "client_id", 36)) ? text(data, "client_id", 36) : null,
      vehicle_id: UUID_RE.test(text(data, "vehicle_id", 36)) ? text(data, "vehicle_id", 36) : null,
      category_label: text(data, "category_label", 40),
      paid_at: (paid ?? 0) > 0 ? toArgentinaTimestamp(paymentDate, paymentTime) : null,
      full_name: text(data, "full_name", 120),
      whatsapp,
      vehicle_category: text(data, "vehicle_category", 20),
      brand: text(data, "brand", 60),
      model: text(data, "model", 60),
      address: text(data, "address", 200),
      neighborhood: text(data, "neighborhood", 120),
      service: text(data, "service", 120),
      performed_at: toArgentinaTimestamp(date, time),
      final_price: price,
      amount_paid: paid ?? 0,
      method: text(data, "method", 20),
      water_supply: data.get("no_water") === "on" ? "propia" : "domicilio",
      operator: text(data, "operator", 80),
      source,
      notes: text(data, "notes", 1000),
      internal_note: text(data, "internal_note", 4000),
    },
  })
  if (error) return dbError(error, "No se pudo registrar el lavado.")
  revalidatePath("/admin", "layout")
  const returnClient = text(data, "return_client_id", 36)
  if (UUID_RE.test(returnClient)) redirect(`/admin/clientes/${returnClient}#turnos`)
  redirect(`/admin/turnos/${id}`)
}

export async function saveTransferSettings(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const alias = text(data, "alias", 60)
  if (alias && !/^[A-Za-z0-9.\-]{6,20}$/.test(alias) && !/^\d{22}$/.test(alias))
    return fail("El alias debe tener entre 6 y 20 letras, números, puntos o guiones (o un CBU/CVU de 22 dígitos).")
  const { error } = await supabase
    .from("settings")
    .update({ transfer_alias: alias || null, transfer_holder: text(data, "holder", 120) || null, transfer_bank: text(data, "bank", 80) || null })
    .eq("id", 1)
  if (error) return dbError(error, "No se pudieron guardar los datos de transferencia.")
  return done(null, "Datos de transferencia guardados.")
}

export async function newRequestId() {
  return randomUUID()
}
