"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import type { PostgrestError } from "@supabase/supabase-js"
import { getAdminClient } from "@/lib/admin/auth"
import { conflictSummary, findConflicts } from "@/lib/admin/conflicts"
import { isValidDate, isValidTime, todayArgentina } from "@/lib/admin/format"
import { BLOCKED_DATES_TAG } from "@/lib/blocked-dates"
import { PRICES_TAG, parsePrices } from "@/lib/prices"
import { EXPENSE_CATEGORY, INQUIRY_STATUS, PAYMENT_METHOD, VEHICLE_CATEGORY } from "@/lib/admin/labels"
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

export async function blockDate(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const day = text(data, "day", 10)
  if (!isValidDate(day)) return fail("Fecha inválida.")
  const reason = text(data, "reason", 120)
  const { error } = await supabase.from("blocked_dates").upsert({ day, reason })
  if (error) return dbError(error, "No se pudo bloquear el día.")
  revalidateTag(BLOCKED_DATES_TAG, "max")
  revalidatePath("/")
  return done("Día bloqueado. La web deja de aceptar reservas para esa fecha.")
}

export async function unblockDate(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const day = text(data, "day", 10)
  if (!isValidDate(day)) return fail("Fecha inválida.")
  const { error } = await supabase.from("blocked_dates").delete().eq("day", day)
  if (error) return dbError(error, "No se pudo desbloquear el día.")
  revalidateTag(BLOCKED_DATES_TAG, "max")
  revalidatePath("/")
  return done("Día desbloqueado.")
}

export async function seedDemoData(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const perMonth = Number(text(data, "per_month", 3) || 100)
  if (!Number.isInteger(perMonth) || perMonth < 10 || perMonth > 300) return fail("Elegí entre 10 y 300 vehículos por mes.")
  const { data: result, error } = await supabase.rpc("seed_demo_data", { p_vehicles_per_month: perMonth })
  if (error) return dbError(error, "No se pudieron generar los datos de prueba.")
  const r = result as { appointments: number; vehicles: number; clients: number }
  return done(`Listo: ${r.clients} clientes, ${r.appointments} turnos y ${r.vehicles} vehículos de prueba.`)
}

export async function purgeDemoData(_prev: ActionState): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a iniciar sesión.")
  const { error } = await supabase.rpc("purge_demo_data")
  if (error) return dbError(error, "No se pudieron eliminar los datos de prueba. No se borró nada.")
  return done("Datos de prueba eliminados. Tus datos reales no se tocaron.")
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
  if (!whatsapp) return fail("El WhatsApp no es válido. Para otros países incluí el código (ej. +34).")
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

/** Renames a single turno only; the client record (shared by every turno of the same WhatsApp) stays untouched. */
export async function updateAppointmentContactName(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const name = text(data, "contact_name", 120)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (name && name.length < 2) return fail("Ingresá nombre y apellido.")

  const { error } = await supabase.from("appointments").update({ contact_name: name || null }).eq("id", id)
  if (error) return dbError(error, "No se pudo guardar el nombre del turno.")
  return done(name ? "Nombre guardado solo para este turno." : "Este turno vuelve a usar el nombre del cliente.")
}

/** Moves one consulta (with its turnos, servicios and own vehicles) to a brand-new client. */
export async function splitInquiryToNewClient(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const inquiryId = text(data, "inquiry_id", 36)
  const fullName = text(data, "full_name", 120)
  const whatsapp = normalizeWhatsapp(text(data, "whatsapp", 30))
  if (!UUID_RE.test(inquiryId)) return fail("Consulta inválida.")
  if (fullName.length < 2) return fail("Ingresá nombre y apellido.")
  if (!whatsapp) return fail("El WhatsApp no es válido. Para otros países incluí el código (ej. +34).")

  const { data: newId, error } = await supabase.rpc("split_inquiry_to_new_client", {
    p_inquiry_id: inquiryId,
    p_full_name: fullName,
    p_whatsapp: whatsapp,
  })
  if (error) return dbError(error, "No se pudo separar la consulta.")
  revalidatePath("/admin", "layout")
  redirect(`/admin/clientes/${newId as string}`)
}

export async function archiveClient(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  if (!UUID_RE.test(id)) return fail("Cliente inválido.")
  const reason = text(data, "reason", 500)

  const { error } = await supabase.rpc("archive_client", { p_id: id, p_reason: reason || null })
  if (error) return dbError(error, "No se pudo archivar el cliente.")
  return done("Cliente archivado.")
}

export async function restoreClient(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  if (!UUID_RE.test(id)) return fail("Cliente inválido.")

  const { error } = await supabase.rpc("restore_client", { p_id: id })
  if (error) return dbError(error, "No se pudo restaurar el cliente.")
  return done("Cliente restaurado.")
}

export async function deleteClientPermanently(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const confirmation = text(data, "confirmation", 160)
  if (!UUID_RE.test(id)) return fail("Cliente inválido.")
  if (!confirmation) return fail("Escribí el nombre o el WhatsApp del cliente para confirmar.")

  // Single RPC = single transaction: the audit snapshot and the deletion happen together or not at all.
  const { error } = await supabase.rpc("delete_client_permanently", {
    p_id: id,
    p_confirmation: confirmation,
    p_dry_run: false,
  })
  if (error) return dbError(error, "No se pudo eliminar el cliente. No se borró nada.")

  revalidatePath("/admin", "layout")
  redirect("/admin/clientes?estado=archivados&eliminado=1")
}

export async function addVehicle(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const clientId = text(data, "client_id", 36)
  const category = text(data, "category", 10)
  const brand = text(data, "brand", 60)
  const model = text(data, "model", 60)
  if (!UUID_RE.test(clientId)) return fail("Cliente inválido.")
  if (!isVehicleCategory(category)) return fail("Elegí el tipo de vehículo.")
  const label = category === "otro" ? text(data, "category_label", 40) : ""
  if (category === "otro" && label.length < 2) return fail("Indicá qué vehículo es (por ejemplo: Moto, Cuatriciclo).")

  const { error } = await supabase.from("vehicles").insert({
    client_id: clientId,
    category,
    category_label: label || null,
    brand: brand || null,
    model: model || null,
  })
  if (error) return dbError(error, "No se pudo agregar el vehículo.")
  return done("Vehículo agregado.")
}

export async function updateVehicle(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "vehicle_id", 36)
  const category = text(data, "category", 10)
  if (!UUID_RE.test(id)) return fail("Vehículo inválido.")
  if (!isVehicleCategory(category)) return fail("Elegí el tipo de vehículo.")
  const label = category === "otro" ? text(data, "category_label", 40) : ""
  if (category === "otro" && label.length < 2) return fail("Indicá qué vehículo es (por ejemplo: Moto, Cuatriciclo).")
  const plate = text(data, "plate", 12).toUpperCase().replace(/[^A-Z0-9 ]/g, "")

  const { data: updated, error } = await supabase
    .from("vehicles")
    .update({
      category,
      category_label: label || null,
      brand: text(data, "brand", 60) || null,
      model: text(data, "model", 60) || null,
      plate: plate || null,
    })
    .eq("id", id)
    .select("id")
  if (error) return dbError(error, "No se pudo guardar el vehículo.")
  if (!updated?.length) return fail("No se encontró el vehículo.")
  return done("Vehículo guardado.")
}

/**
 * Deleting a vehicle cascades to its turno lines, so it is first removed from every editable
 * turno through the regular flow, which keeps each turno's total and balance in sync.
 */
export async function deleteVehicle(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "vehicle_id", 36)
  if (!UUID_RE.test(id)) return fail("Vehículo inválido.")

  const { data: lines, error: linesError } = await supabase
    .from("appointment_vehicles")
    .select("appointment_id, position, appointments(status)")
    .eq("vehicle_id", id)
    .returns<{ appointment_id: string; position: number; appointments: { status: string } | null }[]>()
  if (linesError) return dbError(linesError, "No se pudo revisar en qué turnos está el vehículo.")

  for (const line of lines ?? []) {
    if (!EDITABLE_VEHICLE_STATUSES.includes(line.appointments?.status ?? "")) continue
    const form = new FormData()
    form.set("appointment_id", line.appointment_id)
    form.set("position", String(line.position))
    const result = await removeVehicleFromAppointment({ ok: false, message: null }, form)
    if (!result.ok) {
      return fail(
        result.message === "El turno tiene que tener al menos un vehículo."
          ? "Es el único vehículo de un turno. Agregá el vehículo correcto a ese turno antes de eliminar este."
          : (result.message ?? "No se pudo quitar el vehículo de sus turnos."),
      )
    }
  }

  const { error } = await supabase.from("vehicles").delete().eq("id", id)
  if (error) return dbError(error, "No se pudo eliminar el vehículo.")
  return done(lines?.length ? "Vehículo eliminado y quitado de sus turnos. Los totales se recalcularon." : "Vehículo eliminado.")
}

export async function updateInquiryStatus(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const status = text(data, "status", 40)
  if (!UUID_RE.test(id)) return fail("Consulta inválida.")
  if (!INQUIRY_STATUS[status]) return fail("Estado inválido.")

  const { error } = await supabase.from("inquiries").update({ commercial_status: status }).eq("id", id)
  if (error) return dbError(error, "No se pudo cambiar el estado.")
  return done("Estado actualizado.")
}

const QUICK_APPOINTMENT_STATUSES = ["solicitado", "confirmado", "realizado", "cancelado", "rechazado"]

export async function quickSetAppointmentStatus(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "appointment_id", 36)
  const status = text(data, "status", 20)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (!QUICK_APPOINTMENT_STATUSES.includes(status)) return fail("Estado inválido.")

  const { error } = await supabase.rpc("admin_set_appointment_status", { p_id: id, p_status: status })
  if (error) return dbError(error, "No se pudo cambiar el estado del turno.")
  return done("Estado del turno actualizado.")
}

export async function quickSetAppointmentPayment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "appointment_id", 36)
  const payment = text(data, "payment", 20)
  const method = text(data, "method", 20) || "efectivo"
  const amount = money(data, "amount", false)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (payment !== "pagado" && payment !== "pendiente") return fail("Estado de pago inválido.")
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")
  if (amount === "invalid") return fail("Revisá el importe.")

  const { error } = await supabase.rpc("admin_set_appointment_payment", {
    p_id: id,
    p_paid: payment === "pagado",
    p_method: method,
    p_amount: amount,
  })
  if (error) return dbError(error, "No se pudo actualizar el pago.")
  revalidatePath("/admin/caja")
  revalidatePath("/admin/cobros")
  return done(payment === "pagado" ? "Marcado como pagado. Ya figura en ingresos." : "Pago anulado: el turno queda pendiente.")
}

export async function updatePaymentMethod(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "payment_id", 36)
  const method = text(data, "method", 20)
  if (!UUID_RE.test(id)) return fail("Pago inválido.")
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")

  const { data: updated, error } = await supabase.from("payments").update({ method }).eq("id", id).select("id")
  if (error) return dbError(error, "No se pudo cambiar el medio de pago.")
  if (!updated?.length) return fail("No se encontró el pago.")
  revalidatePath("/admin/cobros")
  revalidatePath("/admin/caja")
  revalidatePath("/admin/movimientos")
  return done("Medio actualizado.")
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

const APPOINTMENT_ACTIONS = ["confirm", "propose", "client_accepted", "client_rejected", "reject", "cancel"]

export async function manageAppointment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const rawAction = text(data, "action", 20)
  const action = rawAction === "reschedule" ? "propose" : rawAction
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (!APPOINTMENT_ACTIONS.includes(action)) return fail("Acción inválida.")

  const { data: current, error: currentError } = await supabase
    .from("appointments")
    .select("status, requested_start, duration_minutes, operator, appointment_proposals(proposed_start, duration_minutes, status)")
    .eq("id", id)
    .maybeSingle()
  if (currentError) return dbError(currentError, "No se pudo leer el turno.")
  if (!current) return fail("Turno inexistente.")

  let start: string | null = null
  let duration: number | null = null
  let price: number | null = null
  let operator: string | null = null

  if (action === "confirm" || action === "propose") {
    const rawDuration = text(data, "duration", 4)
    if (rawDuration) {
      duration = Number(rawDuration)
      if (!Number.isInteger(duration) || duration < 15 || duration > 540) return fail("La duración debe ser entre 15 y 540 minutos.")
    }
    const p = money(data, "agreed_price", false)
    if (p === "invalid") return fail("El precio acordado no es válido.")
    price = p
    operator = text(data, "operator", 80) || null
  }

  // Pre-check availability so the operator gets a readable list; the DB re-checks atomically.
  let check: { start: string; duration: number } | null = null
  if (action === "confirm") {
    if (!current.requested_start) return fail('El turno no tiene horario solicitado: usá "Proponer otro horario".')
    check = { start: current.requested_start, duration: duration ?? current.duration_minutes }
  } else if (action === "propose") {
    start = dateTime(data, "date", "time")
    if (!start) return fail("Indicá una fecha y hora válidas.")
    check = { start, duration: duration ?? current.duration_minutes }
  } else if (action === "client_accepted") {
    const pending = (current.appointment_proposals ?? []).find((p: { status: string }) => p.status === "pendiente")
    if (!pending) return acceptSentOffer(supabase, id, text(data, "slot", 40))
    check = { start: pending.proposed_start, duration: pending.duration_minutes }
  }

  if (check) {
    const result = await findConflicts(supabase, {
      id,
      start: check.start,
      durationMinutes: check.duration,
      operator: operator ?? current.operator,
    })
    if (!result) return fail("No se pudo verificar la disponibilidad. Probá de nuevo.")
    if (result.blocked) {
      const next =
        action === "propose" ? "Elegí otra alternativa." : 'No se confirmó. Usá "Proponer otro horario" para coordinar otra alternativa.'
      return fail(`Horario no disponible. ${conflictSummary(result)} ${next}`)
    }
  }

  const { error } = await supabase.rpc("manage_appointment", {
    p_id: id,
    p_action: action,
    p_start: start,
    p_duration: duration,
    p_agreed_price: price,
    p_operator: operator,
    p_reason: action === "reject" || action === "cancel" ? text(data, "reason", 300) || null : null,
  })
  if (error) return dbError(error, "No se pudo actualizar el turno.")

  const messages: Record<string, string> = {
    confirm: "Turno confirmado. Ya podés enviar la confirmación por WhatsApp.",
    propose: "Propuesta guardada. El turno queda esperando la aceptación del cliente.",
    client_accepted: "Aceptación registrada. Turno confirmado: enviá la confirmación definitiva por WhatsApp.",
    client_rejected: "Propuesta marcada como no aceptada. Ya podés proponer otra alternativa.",
    reject: "Solicitud rechazada.",
    cancel: "Turno cancelado.",
  }
  return done(messages[action])
}

type OfferSlot = { start: string; duration: number }

/**
 * Quotes sent with the offer link (price + time slots) live in appointment_offers, not in
 * appointment_proposals. When the client accepts by WhatsApp instead of the link, the operator
 * records it here through the same DB function the link uses, so price and slot stay consistent.
 */
async function acceptSentOffer(
  supabase: NonNullable<Awaited<ReturnType<typeof admin>>>,
  appointmentId: string,
  chosenSlot: string,
): Promise<ActionState> {
  const { data: offer, error } = await supabase
    .from("appointment_offers")
    .select("token, version, status, slots")
    .eq("appointment_id", appointmentId)
    .maybeSingle<{ token: string; version: number; status: string; slots: OfferSlot[] | null }>()
  if (error) return dbError(error, "No se pudo leer la propuesta.")
  if (!offer || offer.status === "anulada") return fail("No hay una propuesta pendiente para aceptar.")
  if (offer.status === "aceptada") return fail("Esta propuesta ya fue aceptada.")

  const now = Date.now()
  const slots = (offer.slots ?? []).filter((s) => s?.start)
  const upcoming = slots.filter((s) => new Date(s.start).getTime() >= now)
  const chosen = chosenSlot ? slots.find((s) => new Date(s.start).getTime() === new Date(chosenSlot).getTime()) : null

  let slot: OfferSlot | undefined
  if (chosen) slot = chosen
  else if (slots.length === 1) slot = slots[0]
  else if (upcoming.length === 1) slot = upcoming[0]
  else if (slots.length > 1) return fail("La propuesta tiene varios horarios: abrí el turno y elegí cuál aceptó el cliente.")
  else return fail('La propuesta no tiene horarios. Usá "Proponer otro horario" con el horario acordado.')

  const { error: acceptError } = await supabase.rpc("respond_appointment_offer", {
    p_token: offer.token,
    p_action: "aceptar",
    p_version: offer.version,
    p_start: slot.start,
    p_message: null,
  })
  if (acceptError) return dbError(acceptError, "No se pudo registrar la aceptación.")
  return done("Aceptación registrada. Turno confirmado: enviá la confirmación definitiva por WhatsApp.")
}

/** Manual record only: opening WhatsApp never marks a message as sent, and delivery cannot be verified. */
export async function markWhatsappSent(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const id = text(data, "id", 36)
  const kind = text(data, "kind", 20)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (kind !== "confirmacion" && kind !== "propuesta") return fail("Tipo de mensaje inválido.")

  const { error } = await supabase.rpc("mark_whatsapp_sent", { p_appointment_id: id, p_kind: kind })
  if (error) return dbError(error, "No se pudo registrar el envío.")
  return done("Registrado como enviado.")
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
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")
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

export async function addExpense(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const day = text(data, "day", 10)
  const category = text(data, "category", 20)
  const method = text(data, "method", 20)
  const amount = money(data, "amount", true)

  if (!isValidDate(day)) return fail("Indicá la fecha del gasto.")
  if (day > todayArgentina()) return fail("La fecha del gasto no puede ser futura.")
  if (!EXPENSE_CATEGORY[category]) return fail("Elegí una categoría.")
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")
  if (amount === "invalid" || amount === null || amount <= 0) return fail("Ingresá un importe mayor a cero.")

  const { error } = await supabase.from("expenses").insert({
    spent_on: day,
    category,
    method,
    amount,
    description: text(data, "description", 200) || null,
  })
  if (error) return dbError(error, "No se pudo registrar el gasto.")
  return done("Gasto registrado.")
}

export async function deleteExpense(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "id", 36)
  if (!UUID_RE.test(id)) return fail("Gasto inválido.")
  const { error } = await supabase.from("expenses").delete().eq("id", id)
  if (error) return dbError(error, "No se pudo eliminar el gasto.")
  return done("Gasto eliminado.")
}

export async function updateSettings(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const capacity = Number(text(data, "operational_capacity", 3))
  const duration = Number(text(data, "default_duration_minutes", 4))
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return fail("La capacidad debe ser entre 1 y 20.")
  if (!Number.isInteger(duration) || duration < 15 || duration > 540) return fail("La duración debe ser entre 15 y 540 minutos.")
  const durationDefaults: Record<string, number> = {}
  for (const key of ["auto", "suv", "pickup"]) {
    const value = Number(text(data, `duration_${key}`, 4) || duration)
    if (!Number.isInteger(value) || value < 15 || value > 540) return fail("Las duraciones por vehículo deben ser entre 15 y 540 minutos.")
    durationDefaults[key] = value
  }

  const { error } = await supabase
    .from("settings")
    .update({
      operational_capacity: capacity,
      default_duration_minutes: duration,
      duration_defaults: durationDefaults,
      updated_at: new Date().toISOString(),
    })
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
  if (!isVehicleCategory(category)) return fail("Elegí el tipo de vehículo.")
  const label = category === "otro" ? text(data, "category_label", 40) : ""
  if (category === "otro" && label.length < 2) return fail("Indicá qué vehículo es (por ejemplo: Moto, Cuatriciclo).")
  const priceInput = money(data, "price", category === "otro")
  if (priceInput === "invalid") return fail(category === "otro" ? "Indicá el precio de este vehículo." : "El precio no es válido.")

  const [{ data: appt }, { data: settings }, { data: current }] = await Promise.all([
    supabase.from("appointments").select("status, agreed_price").eq("id", appointmentId).maybeSingle(),
    supabase.from("settings").select("vehicle_prices").eq("id", 1).maybeSingle(),
    supabase.from("appointment_vehicles").select("price_applied").eq("appointment_id", appointmentId).eq("position", position).maybeSingle(),
  ])
  if (!appt) return fail("Turno inexistente.")
  if (!EDITABLE_VEHICLE_STATUSES.includes(appt.status)) return fail("Este turno ya no admite cambios de vehículo.")
  if (!current) return fail("Vehículo no encontrado en el turno.")
  let price = priceInput
  if (price == null) {
    const prices = parsePrices(settings?.vehicle_prices)
    if (!prices) return fail("No se pudieron leer los precios. No se guardó el cambio.")
    price = prices[category as Exclude<VehicleCategory, "otro">]
  }

  const { data: line, error } = await supabase
    .from("appointment_vehicles")
    .update({ category, price_applied: price, needs_review: false })
    .eq("appointment_id", appointmentId)
    .eq("position", position)
    .select("vehicle_id")
    .maybeSingle()
  if (error) return dbError(error, "No se pudo guardar el vehículo.")
  if (!line) return fail("Vehículo no encontrado en el turno.")

  const { error: vehicleError } = await supabase
    .from("vehicles")
    .update({ category, category_label: category === "otro" ? label : null })
    .eq("id", line.vehicle_id)
  if (vehicleError) return dbError(vehicleError, "Se actualizó el turno pero no la ficha del vehículo.")

  const delta = price - (current.price_applied ?? 0)
  if (appt.status === "realizado") {
    if (delta === 0) return done("Vehículo actualizado.")
    const syncError = await syncCompletedTotal(supabase, appointmentId)
    return syncError ?? done("Vehículo actualizado. Se recalculó el total y el saldo del servicio.")
  }
  if (appt.agreed_price != null && delta !== 0) {
    const { error: apptError } = await supabase
      .from("appointments")
      .update({ agreed_price: Math.max(0, appt.agreed_price + delta) })
      .eq("id", appointmentId)
    if (apptError) return dbError(apptError, "Se guardó el vehículo pero no se actualizó el precio acordado.")
  }
  return done(delta !== 0 && appt.agreed_price != null ? "Vehículo actualizado. Se ajustó el precio acordado." : "Vehículo actualizado.")
}

const EDITABLE_VEHICLE_STATUSES = ["solicitado", "reprogramado", "esperando_cliente", "confirmado", "realizado"]

type AdminClient = NonNullable<Awaited<ReturnType<typeof admin>>>

/**
 * A completed turno already has a service record and balance. Its total is the sum of the
 * vehicle lines, applied through the audited price adjustment so the service, the balance
 * and the payment status stay consistent everywhere.
 */
async function syncCompletedTotal(supabase: AdminClient, appointmentId: string): Promise<ActionState | null> {
  const { data: rows, error } = await supabase.from("appointment_vehicles").select("price_applied").eq("appointment_id", appointmentId)
  if (error) return dbError(error, "Se guardó el vehículo pero no se pudo recalcular el total.")
  const total = (rows ?? []).reduce((sum, r) => sum + (r.price_applied ?? 0), 0)
  const { error: apptError } = await supabase.from("appointments").update({ agreed_price: total }).eq("id", appointmentId)
  if (apptError) return dbError(apptError, "Se guardó el vehículo pero no se actualizó el total del turno.")
  const { error: priceError } = await supabase.rpc("admin_adjust_final_price", {
    p_id: appointmentId,
    p_price: total,
    p_reason: "Vehículos del turno actualizados",
  })
  if (priceError) return dbError(priceError, "Se guardó el vehículo pero no se actualizó el saldo del servicio.")
  return null
}
const VEHICLE_CATEGORIES = ["auto", "suv", "pickup", "otro"] as const
type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number]
const MAX_APPOINTMENT_VEHICLES = 10
const FALLBACK_DURATIONS: Record<string, number> = { auto: 60, suv: 75, pickup: 90, otro: 45 }

function isVehicleCategory(value: string): value is VehicleCategory {
  return (VEHICLE_CATEGORIES as readonly string[]).includes(value)
}

function serviceLabelFor(current: string, categories: string[]) {
  if (!current.startsWith("Lavado a domicilio")) return current
  return categories.length === 1
    ? `Lavado a domicilio · ${VEHICLE_CATEGORY[categories[0]] ?? "Otro"}`
    : `Lavado a domicilio · ${categories.length} vehículos`
}

export async function addVehicleToAppointment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const appointmentId = text(data, "appointment_id", 36)
  const existingId = text(data, "vehicle_id", 36)
  const newCategory = text(data, "category", 10)
  if (!UUID_RE.test(appointmentId)) return fail("Turno inválido.")
  if (existingId && !UUID_RE.test(existingId)) return fail("Vehículo inválido.")
  if (!existingId && !isVehicleCategory(newCategory)) return fail("Elegí el tipo del vehículo nuevo.")
  const newLabel = text(data, "category_label", 40)
  if (!existingId && newCategory === "otro" && newLabel.length < 2) {
    return fail("Indicá qué vehículo es (por ejemplo: Moto, Cuatriciclo).")
  }
  const priceInput = money(data, "price", false)
  if (priceInput === "invalid") return fail("El precio del vehículo no es válido.")

  const [{ data: appt }, { data: settings }, { data: lineRows }] = await Promise.all([
    supabase
      .from("appointments")
      .select("status, client_id, vehicle_id, service, duration_minutes, agreed_price, adjusted_price")
      .eq("id", appointmentId)
      .maybeSingle(),
    supabase.from("settings").select("vehicle_prices, duration_defaults").eq("id", 1).maybeSingle(),
    supabase.from("appointment_vehicles").select("position, vehicle_id, category").eq("appointment_id", appointmentId),
  ])
  if (!appt) return fail("Turno inexistente.")
  if (!EDITABLE_VEHICLE_STATUSES.includes(appt.status)) return fail("Este turno ya no admite cambios de vehículo.")
  const prices = parsePrices(settings?.vehicle_prices)
  if (!prices) return fail("No se pudieron leer los precios. No se guardó el cambio.")
  const listPrice = (c: VehicleCategory) => (c === "otro" ? null : prices[c])
  const durations: Record<string, number> = { ...FALLBACK_DURATIONS, ...(settings?.duration_defaults ?? {}) }

  const lines = [...(lineRows ?? [])]
  // Older single-vehicle turnos have no line rows: register the original vehicle first so the list stays complete.
  if (lines.length === 0 && appt.vehicle_id) {
    const { data: original } = await supabase.from("vehicles").select("category").eq("id", appt.vehicle_id).maybeSingle()
    if (original && isVehicleCategory(original.category)) {
      const { error } = await supabase.from("appointment_vehicles").insert({
        appointment_id: appointmentId,
        vehicle_id: appt.vehicle_id,
        position: 1,
        category: original.category,
        // While it is the only vehicle, the agreed price is its price.
        price_applied: appt.adjusted_price ?? appt.agreed_price ?? listPrice(original.category),
        classification: "manual",
      })
      if (error) return dbError(error, "No se pudo preparar la lista de vehículos del turno.")
      lines.push({ position: 1, vehicle_id: appt.vehicle_id, category: original.category })
    }
  }
  if (lines.length >= MAX_APPOINTMENT_VEHICLES) return fail(`Un turno admite hasta ${MAX_APPOINTMENT_VEHICLES} vehículos.`)

  let vehicleId: string
  let category: VehicleCategory
  if (existingId) {
    if (lines.some((l) => l.vehicle_id === existingId)) return fail("Ese vehículo ya está en este turno.")
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, category")
      .eq("id", existingId)
      .eq("client_id", appt.client_id)
      .maybeSingle()
    if (!vehicle || !isVehicleCategory(vehicle.category)) return fail("El vehículo elegido no pertenece a este cliente.")
    vehicleId = vehicle.id
    category = vehicle.category
  } else {
    category = newCategory as VehicleCategory
    const { data: created, error } = await supabase
      .from("vehicles")
      .insert({
        client_id: appt.client_id,
        category,
        category_label: category === "otro" ? newLabel : null,
        brand: text(data, "brand", 60) || null,
        model: text(data, "model", 60) || null,
      })
      .select("id")
      .single()
    if (error || !created) return error ? dbError(error, "No se pudo crear el vehículo.") : fail("No se pudo crear el vehículo.")
    vehicleId = created.id
  }

  const price = priceInput ?? listPrice(category)
  if (price == null) return fail("Indicá el precio de este vehículo.")

  const position = Math.max(0, ...lines.map((l) => l.position)) + 1
  const { error: lineError } = await supabase.from("appointment_vehicles").insert({
    appointment_id: appointmentId,
    vehicle_id: vehicleId,
    position,
    category,
    price_applied: price,
    classification: "manual",
  })
  if (lineError) return dbError(lineError, "No se pudo agregar el vehículo al turno.")

  const categories = [...lines.map((l) => l.category ?? category), category]
  if (appt.status === "realizado") {
    await supabase.from("appointments").update({ service: serviceLabelFor(appt.service, categories) }).eq("id", appointmentId)
    const syncError = await syncCompletedTotal(supabase, appointmentId)
    return syncError ?? done("Vehículo agregado. Se actualizó el total y el saldo del servicio.")
  }
  const duration = Math.min(540, appt.duration_minutes + (durations[category] ?? 60))
  const agreedPrice = appt.agreed_price != null ? appt.agreed_price + price : null
  const { error: apptError } = await supabase
    .from("appointments")
    .update({ duration_minutes: duration, service: serviceLabelFor(appt.service, categories), agreed_price: agreedPrice })
    .eq("id", appointmentId)
  if (apptError) return dbError(apptError, "Se agregó el vehículo pero no se actualizó el turno.")
  return done(
    agreedPrice != null
      ? `Vehículo agregado. Precio acordado: $ ${agreedPrice.toLocaleString("es-AR")}. Duración estimada: ${duration} min.`
      : `Vehículo agregado. Duración estimada: ${duration} min.`,
  )
}

export async function removeVehicleFromAppointment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const appointmentId = text(data, "appointment_id", 36)
  const position = Number(text(data, "position", 2))
  if (!UUID_RE.test(appointmentId)) return fail("Turno inválido.")
  if (!Number.isInteger(position) || position < 1 || position > MAX_APPOINTMENT_VEHICLES) return fail("Vehículo inválido.")

  const [{ data: appt }, { data: settings }, { data: lineRows }] = await Promise.all([
    supabase.from("appointments").select("status, service, duration_minutes, agreed_price").eq("id", appointmentId).maybeSingle(),
    supabase.from("settings").select("duration_defaults").eq("id", 1).maybeSingle(),
    supabase.from("appointment_vehicles").select("position, category, price_applied").eq("appointment_id", appointmentId),
  ])
  if (!appt) return fail("Turno inexistente.")
  if (!EDITABLE_VEHICLE_STATUSES.includes(appt.status)) return fail("Este turno ya no admite cambios de vehículo.")
  const lines = lineRows ?? []
  const target = lines.find((l) => l.position === position)
  if (!target) return fail("Vehículo no encontrado en el turno.")
  if (lines.length <= 1) return fail("El turno tiene que tener al menos un vehículo.")
  const durations: Record<string, number> = { ...FALLBACK_DURATIONS, ...(settings?.duration_defaults ?? {}) }

  const { error } = await supabase.from("appointment_vehicles").delete().eq("appointment_id", appointmentId).eq("position", position)
  if (error) return dbError(error, "No se pudo quitar el vehículo.")

  const remaining = lines.filter((l) => l.position !== position).map((l) => l.category ?? "auto")
  if (appt.status === "realizado") {
    await supabase.from("appointments").update({ service: serviceLabelFor(appt.service, remaining) }).eq("id", appointmentId)
    const syncError = await syncCompletedTotal(supabase, appointmentId)
    return syncError ?? done("Vehículo quitado. Se actualizó el total y el saldo del servicio.")
  }
  const duration = Math.max(15, appt.duration_minutes - (durations[target.category ?? ""] ?? 60))
  const agreedPrice =
    appt.agreed_price != null && target.price_applied != null ? Math.max(0, appt.agreed_price - target.price_applied) : appt.agreed_price
  const { error: apptError } = await supabase
    .from("appointments")
    .update({ duration_minutes: duration, service: serviceLabelFor(appt.service, remaining), agreed_price: agreedPrice })
    .eq("id", appointmentId)
  if (apptError) return dbError(apptError, "Se quitó el vehículo pero no se actualizó el turno.")
  return done(`Vehículo quitado del turno. Sigue en la ficha del cliente. Duración estimada: ${duration} min.`)
}
