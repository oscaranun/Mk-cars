"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import type { PostgrestError } from "@supabase/supabase-js"
import { getAdminClient } from "@/lib/admin/auth"
import { findConflicts } from "@/lib/admin/conflicts"
import { formatDateTime, isValidDate, isValidTime } from "@/lib/admin/format"
import { PRICES_TAG, parsePrices } from "@/lib/prices"
import { EDITABLE_INQUIRY_STATUSES } from "@/lib/admin/labels"
import { TEST_CLIENT_PREFIX, getTestBookingSummary } from "@/lib/admin/test-booking"
import { normalizeWhatsapp, toArgentinaTimestamp } from "@/lib/booking"

export type ActionState = { ok: boolean; message: string | null }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const fail = (message: string): ActionState => ({ ok: false, message })
const done = (message: string): ActionState => {
  revalidatePath("/admin", "layout")
  return { ok: true, message }
}

const text = (data: FormData, key: string, max = 500) => String(data.get(key) ?? "").trim().slice(0, max)

function money(data: FormData, key: string, required: boolean): number | null | "invalid" {
  const raw = text(data, key, 20).replace(/\./g, "").replace(",", ".")
  if (!raw) return required ? "invalid" : null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return "invalid"
  return Math.round(n * 100) / 100
}

function dateTime(data: FormData, dateKey: string, timeKey: string) {
  const date = text(data, dateKey, 10)
  const time = text(data, timeKey, 5)
  if (!isValidDate(date) || !isValidTime(time)) return null
  return toArgentinaTimestamp(date, time)
}

/** Database guards raise P0001/22023 with a message meant for the operator; anything else stays generic. */
function dbError(error: PostgrestError, fallback: string): ActionState {
  console.error("[admin] db error:", error.code, error.message)
  if (error.code === "P0001" || error.code === "22023") return fail(error.message)
  if (error.code === "23505") return fail("Ya existe un registro con esos datos.")
  if (error.code === "42501") return fail("No tenés permisos para esta acción.")
  return fail(fallback)
}

async function admin() {
  return getAdminClient()
}

export async function updateClient(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const fullName = text(data, "full_name", 120)
  const whatsapp = normalizeWhatsapp(text(data, "whatsapp", 30))
  const email = text(data, "email", 160).toLowerCase()
  const notes = text(data, "notes", 2000)
  const marketing = data.get("marketing_consent") === "on"

  if (!UUID_RE.test(id)) return fail("Cliente inválido.")
  if (fullName.length < 2) return fail("Ingresá nombre y apellido.")
  if (!whatsapp) return fail("El WhatsApp no es un número argentino válido.")
  if (email && !EMAIL_RE.test(email)) return fail("El correo no es válido.")

  const { data: current } = await supabase.from("clients").select("marketing_consent").eq("id", id).single()

  const { error } = await supabase
    .from("clients")
    .update({
      full_name: fullName,
      whatsapp,
      email: email || null,
      notes: notes || null,
      marketing_consent: marketing,
      ...(current && current.marketing_consent !== marketing
        ? { marketing_consent_at: marketing ? new Date().toISOString() : null }
        : {}),
    })
    .eq("id", id)
  if (error) return dbError(error, "No se pudo guardar el cliente.")
  return done("Datos del cliente guardados.")
}

export async function addVehicle(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const clientId = text(data, "client_id", 36)
  const category = text(data, "category", 10)
  const brand = text(data, "brand", 60)
  const model = text(data, "model", 60)
  if (!UUID_RE.test(clientId)) return fail("Cliente inválido.")
  if (!["auto", "suv", "pickup"].includes(category)) return fail("Elegí el tipo de vehículo.")

  const { error } = await supabase
    .from("vehicles")
    .insert({ client_id: clientId, category, brand: brand || null, model: model || null })
  if (error) return dbError(error, "No se pudo agregar el vehículo.")
  return done("Vehículo agregado.")
}

export async function updateInquiryStatus(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const status = text(data, "status", 40)
  if (!UUID_RE.test(id)) return fail("Consulta inválida.")
  if (!(EDITABLE_INQUIRY_STATUSES as readonly string[]).includes(status)) return fail("Estado inválido.")

  const { error } = await supabase.from("inquiries").update({ commercial_status: status }).eq("id", id)
  if (error) return dbError(error, "No se pudo cambiar el estado.")
  return done("Estado actualizado.")
}

export async function deleteInquiry(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  if (!UUID_RE.test(id)) return fail("Consulta inválida.")

  // appointments.inquiry_id is ON DELETE SET NULL: deleting would silently alter the linked turno.
  const { data: linked, error: refError } = await supabase.from("appointments").select("id").eq("inquiry_id", id)
  if (refError) return dbError(refError, "No se pudo verificar la consulta.")
  const appointmentIds = (linked ?? []).map((a) => a.id as string)

  if (appointmentIds.length) {
    if (data.get("with_appointments") !== "on") {
      return fail("La consulta tiene un turno vinculado. Marcá la casilla para eliminarlo junto con la consulta.")
    }
    // services.appointment_id has no cascade: a turno with registered work must be handled from Turnos.
    const { count: serviceCount, error: serviceError } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .in("appointment_id", appointmentIds)
    if (serviceError) return dbError(serviceError, "No se pudo verificar el turno vinculado.")
    if (serviceCount) {
      return fail("No se puede eliminar: el turno vinculado ya tiene un servicio registrado. Gestionalo desde Turnos.")
    }

    const { error: apptError } = await supabase.from("appointments").delete().in("id", appointmentIds)
    if (apptError) return dbError(apptError, "No se pudo eliminar el turno vinculado.")
    await supabase.from("status_history").delete().eq("entity", "appointment").in("entity_id", appointmentIds)
  }

  const { data: deleted, error } = await supabase.from("inquiries").delete().eq("id", id).select("id")
  if (error) {
    if (error.code === "23503") return fail("No se puede eliminar: hay registros vinculados a esta consulta.")
    return dbError(error, "No se pudo eliminar la consulta.")
  }
  if (!deleted?.length) return fail("La consulta no existe o no tenés permisos para eliminarla.")
  return done("Consulta eliminada.")
}

export async function deleteTestBooking(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const clientId = text(data, "client_id", 36)
  if (!UUID_RE.test(clientId)) return fail("Cliente inválido.")

  const { summary, error: summaryError } = await getTestBookingSummary(supabase, clientId)
  if (!summary) return fail(summaryError ?? "No se pudo verificar la reserva de prueba.")
  if (summary.conflicts.length) return fail(`No se eliminó nada: ${summary.conflicts.join(" ")}`)

  // A single DELETE is atomic: its FK cascades only reach rows of this client, verified above.
  const { data: deleted, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .ilike("full_name", `${TEST_CLIENT_PREFIX}%`)
    .select("id")
  if (error) return dbError(error, "No se pudo eliminar la reserva de prueba.")
  if (!deleted?.length) return fail("La reserva de prueba no existe o no tenés permisos para eliminarla.")

  // status_history has no FK to its entities, so its rows are removed explicitly afterwards.
  if (summary.historyEntityIds.length) {
    const { error: historyError } = await supabase
      .from("status_history")
      .delete()
      .in("entity_id", summary.historyEntityIds)
    if (historyError) {
      console.error("[admin] test booking history:", historyError.code, historyError.message)
      revalidatePath("/admin", "layout")
      return fail("La reserva se eliminó, pero no su historial de estados. Volvé a intentarlo o avisá al soporte.")
    }
  }

  leaveDeletedAppointment()
}

/**
 * Redirecting from the action itself makes Next render /admin/turnos instead of re-rendering the
 * deleted turno's detail page (which would hit notFound()).
 */
function leaveDeletedAppointment(): never {
  revalidatePath("/admin", "layout")
  redirect("/admin/turnos?eliminada=1")
}

export async function deleteAppointmentPermanently(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")

  // Single RPC = single transaction: everything is deleted or nothing is.
  const { error } = await supabase.rpc("delete_appointment_permanently", { p_id: id, p_dry_run: false })
  if (error) {
    if (error.code === "P0001") return fail(error.message)
    if (error.code === "42501") return fail("No tenés permisos para eliminar reservas.")
    return dbError(error, "No se pudo eliminar la reserva. No se borró nada.")
  }
  leaveDeletedAppointment()
}

export async function manageAppointment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const action = text(data, "action", 20)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (!["confirm", "reschedule", "reject", "cancel"].includes(action)) return fail("Acción inválida.")

  let start: string | null = null
  let duration: number | null = null
  let price: number | null = null
  if (action === "confirm" || action === "reschedule") {
    start = dateTime(data, "date", "time")
    if (!start) return fail("Indicá una fecha y hora válidas.")
    if (new Date(start).getTime() < Date.now() - 60 * 60 * 1000) return fail("La fecha ya pasó.")
    const rawDuration = text(data, "duration", 4)
    if (rawDuration) {
      duration = Number(rawDuration)
      if (!Number.isInteger(duration) || duration < 15 || duration > 540) return fail("La duración debe ser entre 15 y 540 minutos.")
    }
  }
  if (action === "confirm") {
    const p = money(data, "agreed_price", false)
    if (p === "invalid") return fail("El precio acordado no es válido.")
    price = p

    let effectiveDuration = duration
    if (effectiveDuration == null) {
      const { data: current } = await supabase.from("appointments").select("duration_minutes").eq("id", id).maybeSingle()
      effectiveDuration = current?.duration_minutes ?? 60
    }
    const check = await findConflicts(supabase, { id, start: start!, durationMinutes: effectiveDuration! })
    if (!check) return fail("No se pudo verificar la disponibilidad. Probá de nuevo.")
    if (check.conflicts.length >= check.capacity) {
      const list = check.conflicts
        .map((c) => `${formatDateTime(c.confirmed_start)} (${c.duration_minutes} min${c.clientName ? `, ${c.clientName}` : ""})`)
        .join("; ")
      const travel = check.travelMinutes ? ` más ${check.travelMinutes} min de traslado` : ""
      return fail(
        `Horario ocupado: se superpone${travel} con ${list}. No se confirmó. Elegí otro horario o reprogramá la solicitud.`,
      )
    }
  }

  const { error } = await supabase.rpc("manage_appointment", {
    p_id: id,
    p_action: action,
    p_start: start,
    p_duration: duration,
    p_agreed_price: price,
    p_operator: action === "confirm" ? text(data, "operator", 80) || null : null,
  })
  if (error) return dbError(error, "No se pudo actualizar el turno.")

  const messages: Record<string, string> = {
    confirm: "Turno confirmado.",
    reschedule: "Turno reprogramado. Queda pendiente de confirmación.",
    reject: "Turno rechazado.",
    cancel: "Turno cancelado.",
  }
  return done(messages[action])
}

export async function completeAppointment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const performedAt = dateTime(data, "date", "time")
  const category = text(data, "vehicle_category", 10)
  const washType = text(data, "wash_type", 120)
  const agreed = money(data, "agreed_price", false)
  const final = money(data, "final_price", true)

  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (!performedAt) return fail("Indicá la fecha y hora real del lavado.")
  if (new Date(performedAt).getTime() > Date.now() + 60 * 60 * 1000) return fail("La fecha del lavado no puede ser futura.")
  if (!["auto", "suv", "pickup"].includes(category)) return fail("Elegí el tipo de vehículo.")
  if (washType.length < 2) return fail("Indicá el tipo de lavado.")
  if (agreed === "invalid") return fail("El precio acordado no es válido.")
  if (final === "invalid" || final === null) return fail("Ingresá el precio final.")

  const { error } = await supabase.rpc("complete_appointment", {
    p_id: id,
    p_performed_at: performedAt,
    p_vehicle_category: category,
    p_wash_type: washType,
    p_agreed_price: agreed,
    p_final_price: final,
    p_operator: text(data, "operator", 80) || null,
    p_notes: text(data, "notes", 2000) || null,
  })
  if (error) return dbError(error, "No se pudo registrar el servicio.")
  return done("Servicio registrado. Ya podés cargar el cobro.")
}

export async function addPayment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const serviceId = text(data, "service_id", 36)
  const amount = money(data, "amount", true)
  const method = text(data, "method", 20)
  const date = text(data, "date", 10)

  if (!UUID_RE.test(serviceId)) return fail("Servicio inválido.")
  if (amount === "invalid" || amount === null || amount <= 0) return fail("Ingresá un importe mayor a cero.")
  if (!["efectivo", "transferencia", "otro"].includes(method)) return fail("Elegí el medio de pago.")
  if (!isValidDate(date)) return fail("Indicá la fecha de pago.")
  const paidAt = toArgentinaTimestamp(date, "12:00")
  if (new Date(paidAt).getTime() > Date.now() + 24 * 60 * 60 * 1000) return fail("La fecha de pago no puede ser futura.")

  const { error } = await supabase.rpc("add_payment", {
    p_service_id: serviceId,
    p_amount: amount,
    p_method: method,
    p_paid_at: paidAt,
    p_notes: text(data, "notes", 500) || null,
  })
  if (error) return dbError(error, "No se pudo registrar el pago.")
  return done("Pago registrado.")
}

export async function updateSettings(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const capacity = Number(text(data, "operational_capacity", 3))
  const duration = Number(text(data, "default_duration_minutes", 4))
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return fail("La capacidad debe ser entre 1 y 20.")
  if (!Number.isInteger(duration) || duration < 15 || duration > 540) return fail("La duración debe ser entre 15 y 540 minutos.")

  const { error } = await supabase
    .from("settings")
    .update({ operational_capacity: capacity, default_duration_minutes: duration, updated_at: new Date().toISOString() })
    .eq("id", 1)
  if (error) return dbError(error, "No se pudo guardar la configuración.")
  return done("Configuración guardada.")
}

export async function updatePrices(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const prices = parsePrices({
    auto: text(data, "price_auto", 9).replace(/\./g, ""),
    suv: text(data, "price_suv", 9).replace(/\./g, ""),
    pickup: text(data, "price_pickup", 9).replace(/\./g, ""),
  })
  if (!prices) return fail("Los precios deben ser números enteros mayores a cero.")

  const { error } = await supabase
    .from("settings")
    .update({ vehicle_prices: prices, updated_at: new Date().toISOString() })
    .eq("id", 1)
  if (error) return dbError(error, "No se pudieron guardar los precios.")
  revalidateTag(PRICES_TAG, "max")
  revalidatePath("/")
  return done("Precios guardados. La web los muestra en el próximo minuto.")
}

/** Operator-verified category: re-prices the line from settings and clears the review flag. */
export async function reviewAppointmentVehicle(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const appointmentId = text(data, "appointment_id", 36)
  const position = Number(text(data, "position", 2))
  const category = text(data, "category", 10)
  if (!UUID_RE.test(appointmentId)) return fail("Turno inválido.")
  if (!Number.isInteger(position) || position < 1 || position > 10) return fail("Vehículo inválido.")
  if (!["auto", "suv", "pickup"].includes(category)) return fail("Elegí el tipo de vehículo.")

  const [{ data: appt }, { data: settings }] = await Promise.all([
    supabase.from("appointments").select("status").eq("id", appointmentId).maybeSingle(),
    supabase.from("settings").select("vehicle_prices").eq("id", 1).maybeSingle(),
  ])
  if (!appt) return fail("Turno inexistente.")
  if (!["solicitado", "reprogramado", "confirmado"].includes(appt.status)) {
    return fail("Este turno ya no admite cambios de vehículo.")
  }
  const prices = parsePrices(settings?.vehicle_prices)
  if (!prices) return fail("No se pudieron leer los precios. No se guardó el cambio.")

  const { data: line, error } = await supabase
    .from("appointment_vehicles")
    .update({ category, price_applied: prices[category as keyof typeof prices], needs_review: false })
    .eq("appointment_id", appointmentId)
    .eq("position", position)
    .select("vehicle_id")
    .maybeSingle()
  if (error) return dbError(error, "No se pudo guardar la categoría.")
  if (!line) return fail("Vehículo no encontrado en el turno.")

  const { error: vehicleError } = await supabase.from("vehicles").update({ category }).eq("id", line.vehicle_id)
  if (vehicleError) return dbError(vehicleError, "Se actualizó el turno pero no la ficha del vehículo.")
  return done("Categoría verificada.")
}
