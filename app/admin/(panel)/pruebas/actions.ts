"use server"

import { revalidatePath } from "next/cache"
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import { getAdminClient } from "@/lib/admin/auth"
import { isValidDate, isValidTime, todayArgentina } from "@/lib/admin/format"
import { EXPENSE_CATEGORY, PANEL_VEHICLE_CATEGORY, PAYMENT_METHOD } from "@/lib/admin/labels"
import { toArgentinaTimestamp } from "@/lib/booking"
import type { ActionState } from "../crm-actions"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (message: string): ActionState => ({ ok: false, message })
const done = (message: string): ActionState => {
  revalidatePath("/admin", "layout")
  return { ok: true, message }
}
const text = (data: FormData, key: string, max = 300) => String(data.get(key) ?? "").trim().slice(0, max)

function amount(data: FormData, key: string): number | null {
  const raw = text(data, key, 20).replace(/\./g, "").replace(",", ".")
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return null
  return Math.round(n * 100) / 100
}

function dbError(error: PostgrestError, fallback: string): ActionState {
  console.error("[pruebas] db error:", error.code, error.message)
  if (error.code === "P0001" || error.code === "22023") return fail(error.message)
  if (error.code === "42501") return fail("No tenés permisos para esta acción.")
  return fail(fallback)
}

async function session(data: FormData) {
  const supabase = await getAdminClient()
  if (!supabase) return { error: fail("Sesión vencida. Volvé a ingresar.") } as const
  const id = text(data, "appointment_id", 36)
  if (!UUID_RE.test(id)) return { error: fail("Turno inválido.") } as const
  return { supabase, id } as const
}

/* ---------------------------------- Datos --------------------------------- */

export async function saveTurnoData(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session(data)
  if ("error" in s) return s.error ?? fail("Error")
  const { supabase, id } = s

  const date = text(data, "date", 10)
  const time = text(data, "time", 5)
  const address = text(data, "address", 200)
  const discount = amount(data, "discount") ?? 0
  if (address.length < 3) return fail("Ingresá la dirección.")

  if (date || time) {
    if (!isValidDate(date) || !isValidTime(time)) return fail("Completá fecha y hora válidas.")
    const start = toArgentinaTimestamp(date, time)
    const { error } = await supabase.rpc("admin_reschedule_appointment", {
      p_id: id,
      p_start: start,
      p_reason: "Editado desde la ficha",
    })
    if (error) return dbError(error, "No se pudo cambiar la fecha.")
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      contact_name: text(data, "contact_name", 120) || null,
      address,
      neighborhood: text(data, "neighborhood", 120) || null,
      operator: text(data, "operator", 80) || null,
      service: text(data, "service", 120) || "Lavado",
      discount,
    })
    .eq("id", id)
  if (error) return dbError(error, "No se pudieron guardar los datos.")
  return done("Ficha actualizada.")
}

/* --------------------------------- Estado --------------------------------- */

const STATUSES = ["solicitado", "confirmado", "reprogramado", "realizado", "cancelado"] as const

export async function setTurnoStatus(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session(data)
  if ("error" in s) return s.error ?? fail("Error")
  const { supabase, id } = s
  const status = text(data, "status", 20) as (typeof STATUSES)[number]
  if (!STATUSES.includes(status)) return fail("Elegí un estado.")

  const { data: current } = await supabase.from("appointments").select("status").eq("id", id).maybeSingle()
  if (!current) return fail("Turno inexistente.")

  if (status === "reprogramado") {
    const date = text(data, "date", 10)
    const time = text(data, "time", 5)
    if (!isValidDate(date) || !isValidTime(time)) return fail("Indicá la nueva fecha y hora.")
    if (current.status === "realizado") return fail("El lavado ya está realizado: no se puede reprogramar.")
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "reprogramado",
        requested_start: toArgentinaTimestamp(date, time),
        confirmed_start: null,
        confirmed_at: null,
      })
      .eq("id", id)
    if (error) return dbError(error, "No se pudo reprogramar.")
    return done("Turno reprogramado. Cuando el cliente lo acepte, pasalo a Confirmado.")
  }

  const { error } = await supabase.rpc("admin_set_appointment_status", { p_id: id, p_status: status })
  if (error) return dbError(error, "No se pudo cambiar el estado.")

  if (status === "cancelado") {
    const reason = text(data, "reason", 300)
    if (reason) await supabase.from("appointments").update({ cancel_reason: reason }).eq("id", id)
  }
  const labels: Record<string, string> = {
    solicitado: "Turno vuelto a Solicitado.",
    confirmado: "Turno confirmado.",
    realizado: "Lavado marcado como realizado.",
    cancelado: "Turno cancelado.",
  }
  return done(labels[status])
}

/* ---------------------------------- Pagos --------------------------------- */

async function paidSoFar(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("payments")
    .select("amount")
    .eq("appointment_id", id)
    .eq("kind", "servicio")
    .is("voided_at", null)
  return (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
}

export async function registerPayment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session(data)
  if ("error" in s) return s.error ?? fail("Error")
  const { supabase, id } = s
  const mode = text(data, "mode", 10)
  const method = text(data, "method", 20) || "efectivo"
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")

  const { data: price } = await supabase.rpc("appointment_final_price", { p_id: id })
  const total = Number(price ?? 0)
  if (total <= 0) return fail("El turno no tiene precio: cargá el precio de los vehículos primero.")
  const paid = await paidSoFar(supabase, id)

  let target = total
  if (mode === "parcial") {
    const value = amount(data, "amount")
    if (!value || value <= 0) return fail("Ingresá el importe del pago parcial.")
    target = Math.round((paid + value) * 100) / 100
    if (target > total) return fail(`El pago supera el saldo pendiente ($${(total - paid).toLocaleString("es-AR")}).`)
  }
  if (target <= paid) return fail("El turno ya está pagado.")

  const { error } = await supabase.rpc("admin_set_collected_amount", {
    p_id: id,
    p_amount: target,
    p_method: method,
    p_paid_at: null,
    p_reason: mode === "parcial" ? "Pago parcial" : "Pago total",
  })
  if (error) return dbError(error, "No se pudo registrar el pago.")
  return done(target >= total ? "Pago total registrado." : "Pago parcial registrado.")
}

export async function undoPayments(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session(data)
  if ("error" in s) return s.error ?? fail("Error")
  const { error } = await s.supabase.rpc("admin_set_collected_amount", {
    p_id: s.id,
    p_amount: 0,
    p_method: "efectivo",
    p_paid_at: null,
    p_reason: "Pagos anulados desde la ficha",
  })
  if (error) return dbError(error, "No se pudieron anular los pagos.")
  return done("Pagos anulados. El turno vuelve a pago pendiente.")
}

/* -------------------------------- Vehículos ------------------------------- */

type LineInput = { category: string; label: string | null; brand: string | null; model: string | null; price: number | null }

function readVehicle(data: FormData): LineInput | ActionState {
  const category = text(data, "category", 20)
  if (!PANEL_VEHICLE_CATEGORY[category]) return fail("Elegí el tipo de vehículo.")
  const label = text(data, "category_label", 40)
  if (category === "otro" && label.length < 2) return fail("Indicá qué vehículo es (moto, cuatri, lancha…).")
  const price = amount(data, "price")
  return {
    category,
    label: category === "otro" ? label : null,
    brand: text(data, "brand", 60) || null,
    model: text(data, "model", 60) || null,
    price: price === null ? null : Math.round(price),
  }
}

/** Turnos created before multi-vehicle support only have `appointments.vehicle_id`. */
async function ensureLines(supabase: SupabaseClient, id: string) {
  const { count } = await supabase
    .from("appointment_vehicles")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", id)
  if (count) return
  const { data: appt } = await supabase.from("appointments").select("vehicle_id, agreed_price").eq("id", id).maybeSingle()
  if (!appt?.vehicle_id) return
  const { data: v } = await supabase.from("vehicles").select("category").eq("id", appt.vehicle_id).maybeSingle()
  await supabase.from("appointment_vehicles").insert({
    appointment_id: id,
    vehicle_id: appt.vehicle_id,
    position: 1,
    category: v?.category ?? "auto",
    price_applied: appt.agreed_price === null ? null : Math.round(Number(appt.agreed_price)),
  })
}

/** Total = sum of vehicle prices; the final price follows it (minus discount). */
async function recalcTotal(supabase: SupabaseClient, id: string) {
  const { data: lines } = await supabase.from("appointment_vehicles").select("price_applied").eq("appointment_id", id)
  const priced = (lines ?? []).filter((l) => l.price_applied !== null)
  if (priced.length === 0) return null
  const sum = priced.reduce((acc, l) => acc + Number(l.price_applied), 0)
  const { data: appt } = await supabase.from("appointments").select("status, discount").eq("id", id).maybeSingle()
  const { error } = await supabase.from("appointments").update({ agreed_price: sum, adjusted_price: null }).eq("id", id)
  if (error) return error
  if (appt?.status === "realizado") {
    const final = Math.max(sum - Number(appt.discount ?? 0), 0)
    const { error: adjustError } = await supabase.rpc("admin_adjust_final_price", {
      p_id: id,
      p_price: final,
      p_reason: "Cambio de vehículos desde la ficha",
    })
    if (adjustError) return adjustError
  }
  return null
}

export async function saveVehicle(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session(data)
  if ("error" in s) return s.error ?? fail("Error")
  const { supabase, id } = s
  const input = readVehicle(data)
  if ("ok" in input) return input
  let position = Number(text(data, "position", 3))
  if (!Number.isInteger(position) || position < 0) return fail("Vehículo inválido.")

  await ensureLines(supabase, id)
  if (position === 0) position = 1

  const { data: line } = await supabase
    .from("appointment_vehicles")
    .select("vehicle_id")
    .eq("appointment_id", id)
    .eq("position", position)
    .maybeSingle()
  if (!line) return fail("No se encontró el vehículo.")

  const { error: vError } = await supabase
    .from("vehicles")
    .update({ category: input.category, category_label: input.label, brand: input.brand, model: input.model })
    .eq("id", line.vehicle_id)
  if (vError) return dbError(vError, "No se pudo actualizar el vehículo.")

  const { error: lError } = await supabase
    .from("appointment_vehicles")
    .update({ category: input.category, price_applied: input.price, needs_review: false })
    .eq("appointment_id", id)
    .eq("position", position)
  if (lError) return dbError(lError, "No se pudo actualizar el precio.")

  const recalc = await recalcTotal(supabase, id)
  if (recalc) return dbError(recalc, "No se pudo recalcular el total.")
  return done("Vehículo actualizado.")
}

export async function addVehicle(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session(data)
  if ("error" in s) return s.error ?? fail("Error")
  const { supabase, id } = s
  const input = readVehicle(data)
  if ("ok" in input) return input
  if (input.price === null) return fail("Ingresá el precio del vehículo.")

  const { data: appt } = await supabase.from("appointments").select("client_id, status").eq("id", id).maybeSingle()
  if (!appt) return fail("Turno inexistente.")
  if (appt.status === "cancelado") return fail("El turno está cancelado.")

  await ensureLines(supabase, id)
  const { data: last } = await supabase
    .from("appointment_vehicles")
    .select("position")
    .eq("appointment_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: vehicle, error: vError } = await supabase
    .from("vehicles")
    .insert({
      client_id: appt.client_id,
      category: input.category,
      category_label: input.label,
      brand: input.brand,
      model: input.model,
    })
    .select("id")
    .single()
  if (vError || !vehicle) return dbError(vError!, "No se pudo crear el vehículo.")

  const { error: lError } = await supabase.from("appointment_vehicles").insert({
    appointment_id: id,
    vehicle_id: vehicle.id,
    position: (last?.position ?? 0) + 1,
    category: input.category,
    price_applied: input.price,
  })
  if (lError) return dbError(lError, "No se pudo agregar el vehículo al turno.")

  const recalc = await recalcTotal(supabase, id)
  if (recalc) return dbError(recalc, "No se pudo recalcular el total.")
  return done("Vehículo agregado al turno.")
}

export async function removeVehicle(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session(data)
  if ("error" in s) return s.error ?? fail("Error")
  const { supabase, id } = s
  const position = Number(text(data, "position", 3))

  const { data: lines } = await supabase
    .from("appointment_vehicles")
    .select("position, vehicle_id")
    .eq("appointment_id", id)
    .order("position")
  if (!lines || lines.length < 2) return fail("El turno tiene que tener al menos un vehículo.")
  const target = lines.find((l) => l.position === position)
  if (!target) return fail("No se encontró el vehículo.")

  const { error } = await supabase.from("appointment_vehicles").delete().eq("appointment_id", id).eq("position", position)
  if (error) return dbError(error, "No se pudo quitar el vehículo.")

  const remaining = lines.find((l) => l.position !== position)
  await supabase
    .from("appointments")
    .update({ vehicle_id: remaining?.vehicle_id })
    .eq("id", id)
    .eq("vehicle_id", target.vehicle_id)

  const recalc = await recalcTotal(supabase, id)
  if (recalc) return dbError(recalc, "No se pudo recalcular el total.")
  return done("Vehículo quitado del turno.")
}

/* ---------------------------------- Notas --------------------------------- */

export async function addTurnoNote(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session(data)
  if ("error" in s) return s.error ?? fail("Error")
  const body = text(data, "body", 1000)
  if (body.length < 2) return fail("Escribí la nota.")
  const {
    data: { user },
  } = await s.supabase.auth.getUser()
  const { error } = await s.supabase
    .from("appointment_notes")
    .insert({ appointment_id: s.id, body, author_id: user?.id, author_email: user?.email })
  if (error) return dbError(error, "No se pudo guardar la nota.")
  return done("Nota agregada.")
}

/* -------------------------------- Finanzas -------------------------------- */

export async function addFinanceEntry(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")

  const kind = text(data, "kind", 10)
  if (kind !== "ingreso" && kind !== "gasto") return fail("Elegí si es ingreso o gasto.")
  const choice = text(data, "concept", 60)
  const concept = choice === "__nuevo" ? text(data, "new_concept", 60) : choice
  if (concept.length < 2) return fail("Elegí o escribí el concepto.")
  const value = amount(data, "amount")
  if (!value || value <= 0) return fail("Ingresá un importe mayor a cero.")
  const method = text(data, "method", 20) || "efectivo"
  if (!PAYMENT_METHOD[method]) return fail("Elegí el medio de pago.")
  const date = text(data, "date", 10) || todayArgentina()
  if (!isValidDate(date)) return fail("La fecha no es válida.")
  if (date > todayArgentina()) return fail("La fecha no puede ser futura.")
  const notes = text(data, "notes", 500) || null

  if (kind === "gasto") {
    const key = concept.toLowerCase()
    const { error } = await supabase.from("expenses").insert({
      spent_on: date,
      category: EXPENSE_CATEGORY[key] ? key : "otro",
      amount: value,
      method,
      description: concept,
      notes,
      is_demo: true,
    })
    if (error) return dbError(error, "No se pudo guardar el gasto.")
  } else {
    const { error } = await supabase
      .from("other_incomes")
      .insert({ received_on: date, concept, amount: value, method, notes, is_demo: true })
    if (error) return dbError(error, "No se pudo guardar el ingreso.")
  }

  let saved = ""
  if (choice === "__nuevo" && data.get("save_preset") === "on") {
    const { error } = await supabase.from("finance_concepts").insert({ kind, name: concept })
    saved = error ? (error.code === "23505" ? " (ya existía como predeterminado)" : "") : ` y "${concept}" quedó como predeterminado`
  }
  return done(`${kind === "gasto" ? "Gasto" : "Ingreso"} cargado${saved}.`)
}

export async function deleteFinanceEntry(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "id", 36)
  const table = text(data, "kind", 10) === "gasto" ? "expenses" : "other_incomes"
  if (!UUID_RE.test(id)) return fail("Movimiento inválido.")
  const { error } = await supabase.from(table).delete().eq("id", id).eq("is_demo", true)
  if (error) return dbError(error, "No se pudo borrar.")
  return done("Movimiento borrado.")
}

export async function saveFinanceConcept(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const kind = text(data, "kind", 10)
  const name = text(data, "name", 60)
  if (kind !== "ingreso" && kind !== "gasto") return fail("Elegí ingreso o gasto.")
  if (name.length < 2) return fail("Escribí el nombre.")
  const { error } = await supabase.from("finance_concepts").insert({ kind, name })
  if (error) return error.code === "23505" ? fail("Ese concepto ya existe.") : dbError(error, "No se pudo guardar.")
  return done("Concepto predeterminado agregado.")
}

export async function deleteFinanceConcept(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "id", 36)
  if (!UUID_RE.test(id)) return fail("Concepto inválido.")
  const { error } = await supabase.from("finance_concepts").delete().eq("id", id)
  if (error) return dbError(error, "No se pudo quitar.")
  return done("Concepto quitado de los predeterminados.")
}
