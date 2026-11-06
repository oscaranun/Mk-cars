"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/admin/labels"
import { isValidDate, todayArgentina } from "@/lib/admin/format"
import type { ActionState } from "./crm-actions"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOARD_STATUSES = ["solicitado", "confirmado", "realizado", "cancelado", "rechazado"]
const MAX_PHOTO_BYTES = 8 * 1024 * 1024

const fail = (message: string): ActionState => ({ ok: false, message })
const ok = (message: string): ActionState => {
  revalidatePath("/admin", "layout")
  return { ok: true, message }
}
const text = (data: FormData, key: string, max = 300) => String(data.get(key) ?? "").trim().slice(0, max)

function amount(data: FormData, key: string): number | null {
  const raw = text(data, key, 20).replace(/\./g, "").replace(",", ".")
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? Math.round(n * 100) / 100 : null
}

function int(data: FormData, key: string, min: number, max: number): number | null {
  const n = Number(text(data, key, 10))
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

async function session() {
  const supabase = await createClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isAdmin } = await supabase.rpc("is_admin")
  if (isAdmin !== true) return null
  return { supabase, email: user.email ?? null }
}

type Session = NonNullable<Awaited<ReturnType<typeof session>>>

async function log(s: Session, entity: string, entityId: string | null, action: string, detail?: string) {
  const { error } = await s.supabase
    .from("activity_log")
    .insert({ actor_email: s.email, entity, entity_id: entityId, action, detail: detail ?? null })
  if (error) console.error("[admin] activity log failed:", error.code)
}

function dbFail(error: { code?: string; message: string }, fallback: string) {
  console.error("[admin] db error:", error.code, error.message)
  if (error.code === "P0001" || error.code === "22023") return fail(error.message)
  if (error.code === "23505") return fail("Ya existe un registro con esos datos.")
  return fail(fallback)
}

const EXPIRED = "Sesión vencida. Volvé a ingresar."

export async function moveAppointment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "appointment_id", 36)
  const status = text(data, "status", 20)
  if (!UUID_RE.test(id) || !BOARD_STATUSES.includes(status)) return fail("Movimiento inválido.")
  const { error } = await s.supabase.rpc("admin_set_appointment_status", { p_id: id, p_status: status })
  if (error) return dbFail(error, "No se pudo mover el turno.")
  await log(s, "turno", id, "cambio de estado", status)
  return ok("Turno actualizado.")
}

export async function setVehiclePlate(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "vehicle_id", 36)
  const plate = text(data, "plate", 12).toUpperCase().replace(/[^A-Z0-9 ]/g, "")
  if (!UUID_RE.test(id)) return fail("Vehículo inválido.")
  const { error } = await s.supabase.from("vehicles").update({ plate: plate || null }).eq("id", id)
  if (error) return dbFail(error, "No se pudo guardar la patente.")
  await log(s, "vehiculo", id, "patente", plate || "(vacía)")
  return ok("Patente guardada.")
}

export type PriceRow = { service: string; auto: number; suv: number; pickup: number }

export async function savePriceList(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const services = data.getAll("service").map((v) => String(v).trim().slice(0, 80))
  const rows: PriceRow[] = []
  for (let i = 0; i < services.length; i++) {
    if (!services[i]) continue
    const read = (k: string) => {
      const raw = String(data.getAll(k)[i] ?? "").replace(/\./g, "")
      const n = Number(raw)
      return Number.isInteger(n) && n >= 0 && n <= 10_000_000 ? n : NaN
    }
    const row = { service: services[i], auto: read("auto"), suv: read("suv"), pickup: read("pickup") }
    if ([row.auto, row.suv, row.pickup].some(Number.isNaN)) return fail(`Revisá los precios de "${row.service}".`)
    rows.push(row)
  }
  const { error } = await s.supabase.from("settings").update({ service_prices: rows }).eq("id", 1)
  if (error) return dbFail(error, "No se pudo guardar la lista de precios.")
  await log(s, "precios", null, "lista actualizada", `${rows.length} servicios`)
  return ok("Lista de precios guardada.")
}

export async function saveLoyalty(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const every = int(data, "loyalty_every", 2, 50)
  if (!every) return fail("Elegí un número entre 2 y 50.")
  const { error } = await s.supabase.from("settings").update({ loyalty_every: every }).eq("id", 1)
  if (error) return dbFail(error, "No se pudo guardar.")
  await log(s, "fidelidad", null, "regla actualizada", `lavado gratis cada ${every}`)
  return ok("Regla de fidelidad guardada.")
}

export async function uploadPhoto(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "appointment_id", 36)
  const kind = text(data, "kind", 10)
  const file = data.get("photo")
  if (!UUID_RE.test(id) || !["antes", "despues"].includes(kind)) return fail("Datos inválidos.")
  if (!(file instanceof File) || file.size === 0) return fail("Elegí una foto.")
  if (!file.type.startsWith("image/")) return fail("El archivo tiene que ser una imagen.")
  if (file.size > MAX_PHOTO_BYTES) return fail("La foto supera los 8 MB.")

  const service = createServiceClient()
  if (!service) return fail("Falta configurar el almacenamiento.")
  const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/g, "")
  const path = `${id}/${kind}-${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await service.storage.from("lavados").upload(path, file, { contentType: file.type })
  if (upErr) {
    console.error("[admin] photo upload failed:", upErr.message)
    return fail("No se pudo subir la foto.")
  }
  const { error } = await s.supabase
    .from("appointment_photos")
    .insert({ appointment_id: id, kind, path, uploaded_by_email: s.email })
  if (error) {
    await service.storage.from("lavados").remove([path])
    return dbFail(error, "No se pudo guardar la foto.")
  }
  await log(s, "turno", id, "foto subida", kind)
  return ok("Foto subida.")
}

export async function deletePhoto(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "photo_id", 36)
  if (!UUID_RE.test(id)) return fail("Foto inválida.")
  const { data: row, error } = await s.supabase.from("appointment_photos").delete().eq("id", id).select("path, appointment_id").maybeSingle()
  if (error || !row) return fail("No se pudo borrar la foto.")
  await createServiceClient()?.storage.from("lavados").remove([row.path])
  await log(s, "turno", row.appointment_id, "foto borrada")
  return ok("Foto borrada.")
}

export async function createTask(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const title = text(data, "title", 200)
  const due = text(data, "due_on", 10)
  const clientId = text(data, "client_id", 36)
  if (!title) return fail("Escribí la tarea.")
  if (!isValidDate(due)) return fail("Elegí la fecha.")
  const { error } = await s.supabase.from("admin_tasks").insert({
    title,
    due_on: due,
    client_id: UUID_RE.test(clientId) ? clientId : null,
    created_by_email: s.email,
  })
  if (error) return dbFail(error, "No se pudo crear la tarea.")
  await log(s, "tarea", null, "creada", title)
  return ok("Tarea creada.")
}

export async function toggleTask(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "task_id", 36)
  const isDone = text(data, "done", 5) === "1"
  if (!UUID_RE.test(id)) return fail("Tarea inválida.")
  const { error } = await s.supabase.from("admin_tasks").update({ done_at: isDone ? new Date().toISOString() : null }).eq("id", id)
  if (error) return dbFail(error, "No se pudo actualizar la tarea.")
  await log(s, "tarea", id, isDone ? "completada" : "reabierta")
  return ok(isDone ? "Tarea completada." : "Tarea reabierta.")
}

export async function deleteTask(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "task_id", 36)
  if (!UUID_RE.test(id)) return fail("Tarea inválida.")
  const { error } = await s.supabase.from("admin_tasks").delete().eq("id", id)
  if (error) return dbFail(error, "No se pudo borrar la tarea.")
  await log(s, "tarea", id, "borrada")
  return ok("Tarea borrada.")
}

export async function addPackage(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const clientId = text(data, "client_id", 36)
  const name = text(data, "name", 80)
  const total = int(data, "total_washes", 1, 100)
  const price = amount(data, "price")
  const expires = text(data, "expires_on", 10)
  if (!UUID_RE.test(clientId)) return fail("Cliente inválido.")
  if (!name || !total) return fail("Completá el nombre y la cantidad de lavados.")
  if (expires && !isValidDate(expires)) return fail("Fecha de vencimiento inválida.")
  const { error } = await s.supabase
    .from("client_packages")
    .insert({ client_id: clientId, name, total_washes: total, price: price ?? 0, expires_on: expires || null })
  if (error) return dbFail(error, "No se pudo crear el abono.")
  await log(s, "cliente", clientId, "abono creado", `${name} (${total} lavados)`)
  return ok("Abono creado.")
}

export async function usePackageWash(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "package_id", 36)
  const delta = text(data, "delta", 2) === "-1" ? -1 : 1
  if (!UUID_RE.test(id)) return fail("Abono inválido.")
  const { data: pkg } = await s.supabase.from("client_packages").select("used_washes, total_washes, client_id").eq("id", id).maybeSingle()
  if (!pkg) return fail("Abono no encontrado.")
  const next = pkg.used_washes + delta
  if (next < 0 || next > pkg.total_washes) return fail(delta > 0 ? "El abono ya no tiene lavados disponibles." : "No hay usos para descontar.")
  const { error } = await s.supabase.from("client_packages").update({ used_washes: next }).eq("id", id).eq("used_washes", pkg.used_washes)
  if (error) return dbFail(error, "No se pudo actualizar el abono.")
  await log(s, "cliente", pkg.client_id, delta > 0 ? "lavado de abono usado" : "uso de abono anulado")
  return ok(delta > 0 ? "Lavado descontado del abono." : "Uso anulado.")
}

export async function createCoupon(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const code = text(data, "code", 30).toUpperCase().replace(/[^A-Z0-9-]/g, "")
  const kind = text(data, "kind", 12)
  const value = amount(data, "value")
  const maxUses = text(data, "max_uses", 6) ? int(data, "max_uses", 1, 100000) : null
  const expires = text(data, "expires_on", 10)
  if (code.length < 3) return fail("El código necesita al menos 3 letras o números.")
  if (!["porcentaje", "monto"].includes(kind)) return fail("Elegí el tipo de descuento.")
  if (!value || (kind === "porcentaje" && value > 100)) return fail("Revisá el valor del descuento.")
  if (expires && !isValidDate(expires)) return fail("Fecha inválida.")
  const { error } = await s.supabase
    .from("coupons")
    .insert({ code, kind, value, max_uses: maxUses, expires_on: expires || null })
  if (error) return dbFail(error, "No se pudo crear el cupón.")
  await log(s, "cupon", code, "creado")
  return ok(`Cupón ${code} creado.`)
}

export async function updateCoupon(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "coupon_id", 36)
  const op = text(data, "op", 12)
  if (!UUID_RE.test(id)) return fail("Cupón inválido.")
  const { data: c } = await s.supabase.from("coupons").select("code, uses, max_uses, active, expires_on").eq("id", id).maybeSingle()
  if (!c) return fail("Cupón no encontrado.")
  let patch: Record<string, unknown>
  if (op === "usar") {
    if (!c.active) return fail("El cupón está desactivado.")
    if (c.expires_on && c.expires_on < todayArgentina()) return fail("El cupón está vencido.")
    if (c.max_uses && c.uses >= c.max_uses) return fail("El cupón ya alcanzó el máximo de usos.")
    patch = { uses: c.uses + 1 }
  } else if (op === "toggle") {
    patch = { active: !c.active }
  } else return fail("Acción inválida.")
  const { error } = await s.supabase.from("coupons").update(patch).eq("id", id)
  if (error) return dbFail(error, "No se pudo actualizar el cupón.")
  await log(s, "cupon", c.code, op === "usar" ? "uso registrado" : c.active ? "desactivado" : "activado")
  return ok(op === "usar" ? "Uso registrado." : "Cupón actualizado.")
}

export async function saveCashClosing(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const day = text(data, "day", 10)
  if (!isValidDate(day)) return fail("Fecha inválida.")

  const from = `${day}T00:00:00-03:00`
  const to = `${day}T23:59:59.999-03:00`
  const [{ data: pays }, { data: exps }] = await Promise.all([
    s.supabase.from("payments").select("amount, method").is("voided_at", null).gte("paid_at", from).lte("paid_at", to),
    s.supabase.from("expenses").select("amount, method").eq("spent_on", day),
  ])
  const expected: Record<string, number> = {}
  const counted: Record<string, number> = {}
  for (const m of Object.keys(PAYMENT_METHOD)) expected[m] = 0
  for (const p of pays ?? []) expected[p.method ?? "otro"] = (expected[p.method ?? "otro"] ?? 0) + Number(p.amount)
  for (const e of exps ?? []) expected[e.method ?? "otro"] = (expected[e.method ?? "otro"] ?? 0) - Number(e.amount)
  let difference = 0
  for (const m of Object.keys(PAYMENT_METHOD)) {
    const v = amount(data, `counted_${m}`)
    counted[m] = v ?? 0
    difference += counted[m] - (expected[m] ?? 0)
  }
  const { error } = await s.supabase.from("cash_closings").upsert(
    { day, expected, counted, difference, notes: text(data, "notes", 500) || null, closed_by_email: s.email },
    { onConflict: "day" },
  )
  if (error) return dbFail(error, "No se pudo guardar el cierre.")
  await log(s, "caja", day, "cierre guardado", `diferencia ${difference}`)
  return ok(difference === 0 ? "Cierre guardado. La caja cierra sin diferencias." : "Cierre guardado con diferencia.")
}

export async function addRecurringExpense(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const description = text(data, "description", 120)
  const category = text(data, "category", 20)
  const method = text(data, "method", 20) || "efectivo"
  const value = amount(data, "amount")
  const day = int(data, "day_of_month", 1, 28)
  if (!description || !value) return fail("Completá la descripción y el importe.")
  if (!EXPENSE_CATEGORY[category] || !PAYMENT_METHOD[method]) return fail("Revisá la categoría y el medio de pago.")
  if (!day) return fail("Elegí un día del mes entre 1 y 28.")
  const { error } = await s.supabase
    .from("recurring_expenses")
    .insert({ description, category, method, amount: value, day_of_month: day })
  if (error) return dbFail(error, "No se pudo guardar el gasto fijo.")
  await log(s, "gasto fijo", null, "creado", description)
  return ok("Gasto fijo guardado.")
}

export async function updateRecurringExpense(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const id = text(data, "id", 36)
  const op = text(data, "op", 10)
  if (!UUID_RE.test(id)) return fail("Gasto inválido.")
  const query =
    op === "borrar"
      ? s.supabase.from("recurring_expenses").delete().eq("id", id)
      : s.supabase.from("recurring_expenses").update({ active: op === "activar" }).eq("id", id)
  const { error } = await query
  if (error) return dbFail(error, "No se pudo actualizar.")
  await log(s, "gasto fijo", id, op)
  return ok("Gasto fijo actualizado.")
}

export async function generateRecurringExpenses(_prev: ActionState): Promise<ActionState> {
  const s = await session()
  if (!s) return fail(EXPIRED)
  const today = todayArgentina()
  const month = today.slice(0, 7)
  const { data: rows, error } = await s.supabase
    .from("recurring_expenses")
    .select("id, description, category, method, amount, day_of_month, last_generated_month")
    .eq("active", true)
  if (error) return dbFail(error, "No se pudieron leer los gastos fijos.")
  const pending = (rows ?? []).filter((r) => r.last_generated_month !== month)
  if (pending.length === 0) return ok("Los gastos fijos de este mes ya estaban cargados.")
  const { error: insErr } = await s.supabase.from("expenses").insert(
    pending.map((r) => ({
      spent_on: `${month}-${String(r.day_of_month).padStart(2, "0")}`,
      amount: r.amount,
      description: `${r.description} (gasto fijo)`,
      category: r.category,
      method: r.method,
    })),
  )
  if (insErr) return dbFail(insErr, "No se pudieron cargar los gastos.")
  await s.supabase.from("recurring_expenses").update({ last_generated_month: month }).in("id", pending.map((r) => r.id))
  await log(s, "gasto fijo", null, "gastos del mes cargados", `${pending.length} gastos de ${month}`)
  revalidatePath("/admin/caja")
  return ok(`Se cargaron ${pending.length} gastos fijos de este mes en Egresos.`)
}

export type SearchHit = { href: string; title: string; subtitle: string }

export async function searchPanel(query: string): Promise<SearchHit[]> {
  const s = await session()
  if (!s) return []
  const q = String(query ?? "").trim().slice(0, 60).replace(/[%,()*\\]/g, "")
  if (q.length < 2) return []
  const like = `%${q}%`
  const digits = q.replace(/\D/g, "")

  const clientFilter = [`full_name.ilike.${like}`]
  if (digits.length >= 3) clientFilter.push(`whatsapp.ilike.%${digits}%`)

  const [clients, vehicles] = await Promise.all([
    s.supabase.from("clients").select("id, full_name, whatsapp").or(clientFilter.join(",")).limit(8),
    s.supabase.from("vehicles").select("client_id, brand, model, plate, clients(full_name)").ilike("plate", like).limit(5),
  ])

  const hits: SearchHit[] = (clients.data ?? []).map((c) => ({
    href: `/admin/clientes/${c.id}`,
    title: c.full_name ?? "Sin nombre",
    subtitle: `Cliente · ${c.whatsapp ?? ""}`,
  }))
  for (const v of (vehicles.data ?? []) as unknown as {
    client_id: string
    brand: string | null
    model: string | null
    plate: string | null
    clients: { full_name: string } | null
  }[]) {
    hits.push({
      href: `/admin/clientes/${v.client_id}`,
      title: `${v.plate ?? ""} · ${[v.brand, v.model].filter(Boolean).join(" ")}`,
      subtitle: `Vehículo de ${v.clients?.full_name ?? "cliente"}`,
    })
  }
  return hits
}
