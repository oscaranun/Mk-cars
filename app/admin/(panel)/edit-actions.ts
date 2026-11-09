"use server"

import { revalidatePath } from "next/cache"
import type { PostgrestError } from "@supabase/supabase-js"
import { getAdminClient } from "@/lib/admin/auth"
import { conflictSummary, findConflicts } from "@/lib/admin/conflicts"
import { isValidDate, isValidTime, todayArgentina } from "@/lib/admin/format"
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/admin/labels"
import { toArgentinaTimestamp } from "@/lib/booking"
import type { ActionState } from "./crm-actions"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (message: string): ActionState => ({ ok: false, message })
const done = (message: string): ActionState => {
  revalidatePath("/admin", "layout")
  return { ok: true, message }
}

const text = (data: FormData, key: string, max = 500) => String(data.get(key) ?? "").trim().slice(0, max)

function money(data: FormData, key: string): number | null {
  const raw = text(data, key, 20).replace(/\./g, "").replace(",", ".")
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return null
  return Math.round(n * 100) / 100
}

/** Day picked in the form; keeps the original time of day when the date did not change. */
function paidAtFrom(data: FormData) {
  const date = text(data, "date", 10)
  if (!date) return null
  if (!isValidDate(date)) return "invalid" as const
  const original = text(data, "original_paid_at", 40)
  if (original && text(data, "original_date", 10) === date) return original
  return toArgentinaTimestamp(date, "12:00")
}

/** `datetime-local` value ("YYYY-MM-DDTHH:mm[:ss]") interpreted as Argentina time. */
function paidAtFromLocalInput(data: FormData) {
  const raw = text(data, "paid_at", 25)
  if (!raw) return null
  const [date, timeRaw = ""] = raw.split("T")
  const time = timeRaw.slice(0, 5)
  if (!isValidDate(date) || !isValidTime(time)) return "invalid" as const
  return toArgentinaTimestamp(date, time)
}

function dbError(error: PostgrestError, fallback: string): ActionState {
  console.error("[admin] db error:", error.code, error.message)
  if (error.code === "P0001" || error.code === "22023") return fail(error.message)
  if (error.code === "42501") return fail("No tenés permisos para esta acción.")
  if (error.code === "42883" || error.code === "PGRST202") return fail("Falta aplicar la actualización de base de datos (script 021).")
  return fail(fallback)
}

const TURN_STATUSES = ["solicitado", "esperando_cliente", "confirmado", "cancelado"]
const SERVICE_STATES = ["pendiente", "en_proceso", "realizado"]

type CurrentAppointment = {
  status: string
  requested_start: string | null
  confirmed_start: string | null
  duration_minutes: number
  operator: string | null
}

async function loadAppointment(id: string) {
  const supabase = await getAdminClient()
  if (!supabase) return { error: fail("Sesión vencida. Volvé a ingresar.") } as const
  if (!UUID_RE.test(id)) return { error: fail("Turno inválido.") } as const
  const { data, error } = await supabase
    .from("appointments")
    .select("status, requested_start, confirmed_start, duration_minutes, operator")
    .eq("id", id)
    .maybeSingle<CurrentAppointment>()
  if (error) return { error: dbError(error, "No se pudo leer el turno.") } as const
  if (!data) return { error: fail("Turno inexistente.") } as const
  return { supabase, current: data } as const
}

/** Availability only matters for upcoming work; past dates are administrative records. */
async function checkFutureSlot(
  supabase: NonNullable<Awaited<ReturnType<typeof getAdminClient>>>,
  id: string,
  start: string,
  current: CurrentAppointment,
) {
  if (new Date(start).getTime() <= Date.now()) return null
  const result = await findConflicts(supabase, {
    id,
    start,
    durationMinutes: current.duration_minutes,
    operator: current.operator,
  })
  if (!result) return fail("No se pudo verificar la disponibilidad. Probá de nuevo.")
  if (result.blocked) return fail(`Horario no disponible. ${conflictSummary(result)}`)
  return null
}

export async function quickSetTurnStatus(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = text(data, "appointment_id", 36)
  const status = text(data, "status", 20)
  if (!TURN_STATUSES.includes(status)) return fail("Estado inválido.")
  const loaded = await loadAppointment(id)
  if ("error" in loaded) return loaded.error ?? fail("No se pudo leer el turno.")
  const { supabase, current } = loaded

  if (current.status === status) return { ok: true, message: "Sin cambios." }
  if (current.status === "realizado" && status !== "cancelado") {
    return fail('El lavado ya está realizado. Para volver atrás cambiá el "Servicio" a pendiente.')
  }

  const start = current.confirmed_start ?? current.requested_start

  if (status === "esperando_cliente") {
    if (!start) return fail("Cargá primero la fecha y el horario del turno.")
    const blocked = await checkFutureSlot(supabase, id, start, current)
    if (blocked) return blocked
    const { error } = await supabase.rpc("manage_appointment", {
      p_id: id,
      p_action: "propose",
      p_start: start,
      p_duration: null,
      p_agreed_price: null,
      p_operator: null,
      p_reason: null,
    })
    if (error) return dbError(error, "No se pudo registrar la propuesta.")
    return done("Propuesta registrada: el turno espera la respuesta del cliente.")
  }

  if (status === "confirmado" && start) {
    const blocked = await checkFutureSlot(supabase, id, start, current)
    if (blocked) return blocked
  }

  const { error } = await supabase.rpc("admin_set_appointment_status", { p_id: id, p_status: status })
  if (error) return dbError(error, "No se pudo cambiar el estado del turno.")
  return done("Estado del turno actualizado.")
}

export async function quickSetServiceState(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = text(data, "appointment_id", 36)
  const state = text(data, "state", 20)
  if (!SERVICE_STATES.includes(state)) return fail("Estado de servicio inválido.")
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  if (!UUID_RE.test(id)) return fail("Turno inválido.")

  const { error } = await supabase.rpc("admin_set_service_progress", { p_id: id, p_state: state })
  if (error) return dbError(error, "No se pudo cambiar el estado del servicio.")
  const messages: Record<string, string> = {
    pendiente: "Servicio pendiente.",
    en_proceso: "Servicio en proceso.",
    realizado: "Servicio realizado. Ya podés cargar el cobro.",
  }
  return done(messages[state])
}

export async function quickReschedule(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = text(data, "appointment_id", 36)
  const date = text(data, "date", 10)
  const time = text(data, "time", 5)
  if (!isValidDate(date) || !isValidTime(time)) return fail("Indicá una fecha y hora válidas.")
  const loaded = await loadAppointment(id)
  if ("error" in loaded) return loaded.error ?? fail("No se pudo leer el turno.")
  const { supabase, current } = loaded

  const start = toArgentinaTimestamp(date, time)
  if (["confirmado", "esperando_cliente"].includes(current.status)) {
    const blocked = await checkFutureSlot(supabase, id, start, current)
    if (blocked) return blocked
  }

  const { error } = await supabase.rpc("admin_reschedule_appointment", {
    p_id: id,
    p_start: start,
    p_reason: text(data, "reason", 300) || null,
  })
  if (error) return dbError(error, "No se pudo cambiar la fecha.")
  return done(new Date(start).getTime() < Date.now() ? "Fecha histórica guardada." : "Fecha y horario actualizados.")
}

export async function quickAdjustPrice(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "appointment_id", 36)
  const price = money(data, "price")
  const reason = text(data, "reason", 300)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (price === null) return fail("Ingresá un precio válido.")
  if (reason.length < 3) return fail("Indicá el motivo del ajuste.")

  const { error } = await supabase.rpc("admin_adjust_final_price", { p_id: id, p_price: price, p_reason: reason })
  if (error) return dbError(error, "No se pudo ajustar el precio.")
  return done("Precio final ajustado. El acordado original queda guardado.")
}

export async function quickSetCollected(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "appointment_id", 36)
  const amount = money(data, "amount")
  const method = text(data, "method", 20) || "efectivo"
  const paidAt = paidAtFrom(data)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (amount === null) return fail("Ingresá el importe cobrado.")
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")
  if (paidAt === "invalid") return fail("La fecha de cobro no es válida.")
  if (paidAt && new Date(paidAt).getTime() > Date.now() + 24 * 60 * 60 * 1000) return fail("La fecha de cobro no puede ser futura.")

  const { error } = await supabase.rpc("admin_set_collected_amount", {
    p_id: id,
    p_amount: amount,
    p_method: method,
    p_paid_at: paidAt,
    p_reason: text(data, "reason", 300) || null,
  })
  if (error) return dbError(error, "No se pudo actualizar el cobro.")
  revalidatePath("/admin/movimientos")
  return done("Cobro actualizado. Los ingresos y el saldo se ajustaron sin duplicar.")
}

export async function quickAddTip(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "appointment_id", 36)
  const amount = money(data, "amount")
  const method = text(data, "method", 20) || "efectivo"
  const paidAt = paidAtFrom(data)
  if (!UUID_RE.test(id)) return fail("Turno inválido.")
  if (amount === null || amount <= 0) return fail("Ingresá un importe mayor a cero.")
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")
  if (paidAt === "invalid") return fail("La fecha no es válida.")

  const { error } = await supabase.rpc("admin_add_tip", {
    p_id: id,
    p_amount: amount,
    p_method: method,
    p_paid_at: paidAt,
    p_notes: text(data, "notes", 300) || null,
  })
  if (error) return dbError(error, "No se pudo registrar el adicional.")
  return done("Adicional registrado por separado del precio.")
}

export async function updatePaymentRecord(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "payment_id", 36)
  const amount = money(data, "amount")
  const method = text(data, "method", 20)
  const paidAt = paidAtFromLocalInput(data) ?? paidAtFrom(data)
  const appointmentId = text(data, "appointment_id", 36)
  const reason = text(data, "reason", 300)
  if (!UUID_RE.test(id)) return fail("Movimiento inválido.")
  if (amount === null || amount <= 0) return fail("Ingresá un importe mayor a cero.")
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")
  if (!paidAt || paidAt === "invalid") return fail("Indicá la fecha.")
  if (appointmentId && !UUID_RE.test(appointmentId)) return fail("El servicio vinculado no es válido.")
  if (reason.length < 3) return fail("Indicá el motivo de la corrección.")

  const { data: newId, error } = await supabase.rpc("admin_update_payment", {
    p_payment_id: id,
    p_paid_at: paidAt,
    p_amount: amount,
    p_method: method,
    p_concept: text(data, "concept", 200) || null,
    p_notes: text(data, "notes", 500) || null,
    p_appointment_id: appointmentId || null,
    p_reason: reason,
  })
  if (error) return dbError(error, "No se pudo corregir el ingreso.")
  return done(
    newId && newId !== id
      ? "El día estaba cerrado: se registró una rectificación y el original quedó anulado."
      : "Ingreso corregido. El saldo del servicio se recalculó.",
  )
}

export async function updateExpenseRecord(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "expense_id", 36)
  const day = text(data, "date", 10)
  const category = text(data, "category", 20)
  const method = text(data, "method", 20)
  const amount = money(data, "amount")
  const appointmentId = text(data, "appointment_id", 36)
  const reason = text(data, "reason", 300)
  if (!UUID_RE.test(id)) return fail("Gasto inválido.")
  if (!isValidDate(day)) return fail("Indicá la fecha del gasto.")
  if (day > todayArgentina()) return fail("La fecha del gasto no puede ser futura.")
  if (!EXPENSE_CATEGORY[category]) return fail("Elegí una categoría.")
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")
  if (amount === null || amount <= 0) return fail("Ingresá un importe mayor a cero.")
  if (appointmentId && !UUID_RE.test(appointmentId)) return fail("El servicio vinculado no es válido.")
  if (reason.length < 3) return fail("Indicá el motivo de la corrección.")

  const { data: newId, error } = await supabase.rpc("admin_update_expense", {
    p_id: id,
    p_spent_on: day,
    p_category: category,
    p_amount: amount,
    p_method: method,
    p_description: text(data, "description", 200) || null,
    p_supplier: text(data, "supplier", 120) || null,
    p_notes: text(data, "notes", 500) || null,
    p_appointment_id: appointmentId || null,
    p_reason: reason,
  })
  if (error) return dbError(error, "No se pudo corregir el gasto.")
  return done(
    newId && newId !== id
      ? "El día estaba cerrado: se registró una rectificación y el original quedó anulado."
      : "Gasto corregido.",
  )
}

export async function voidExpenseRecord(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "id", 36)
  const reason = text(data, "reason", 300)
  if (!UUID_RE.test(id)) return fail("Gasto inválido.")
  if (reason.length < 3) return fail("Indicá el motivo de la anulación.")
  const { error } = await supabase.rpc("admin_void_expense", { p_id: id, p_reason: reason })
  if (error) return dbError(error, "No se pudo anular el gasto.")
  return done("Gasto anulado. Queda en el historial.")
}
