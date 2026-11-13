import type { SupabaseClient } from "@supabase/supabase-js"

export type FichaVehicle = {
  position: number
  category: string
  categoryLabel: string | null
  brand: string | null
  model: string | null
  price: number | null
}

export type FichaPayment = { id: string; amount: number; method: string; paidAt: string | null; kind: string }

export type TurnoFicha = {
  id: string
  status: string
  paymentStatus: string
  service: string
  start: string | null
  durationMinutes: number
  address: string
  neighborhood: string | null
  operator: string | null
  contactName: string | null
  cancelReason: string | null
  discount: number
  finalPrice: number
  paid: number
  createdAt: string
  client: { id: string; fullName: string; whatsapp: string | null; email: string | null }
  vehicles: FichaVehicle[]
  payments: FichaPayment[]
  notes: { id: string; body: string; authorEmail: string | null; createdAt: string }[]
  history: { from: string | null; to: string; at: string }[]
}

type Row = {
  id: string
  status: string
  payment_status: string | null
  service: string
  requested_start: string | null
  confirmed_start: string | null
  duration_minutes: number | null
  address: string
  neighborhood: string | null
  operator: string | null
  contact_name: string | null
  cancel_reason: string | null
  discount: number | null
  created_at: string
  vehicle_id: string | null
  client: { id: string; full_name: string; whatsapp: string | null; email: string | null } | null
  legacy_vehicle: { category: string; category_label: string | null; brand: string | null; model: string | null } | null
}

type LineRow = {
  position: number
  category: string | null
  price_applied: number | null
  vehicle: { category: string; category_label: string | null; brand: string | null; model: string | null } | null
}

/** Single source for the turno card so every section shows the same data. */
export async function getTurnoFicha(supabase: SupabaseClient, id: string): Promise<TurnoFicha | null> {
  const { data: row } = await supabase
    .from("appointments")
    .select(
      "id, status, payment_status, service, requested_start, confirmed_start, duration_minutes, address, neighborhood, operator, contact_name, cancel_reason, discount, created_at, vehicle_id, client:clients(id, full_name, whatsapp, email), legacy_vehicle:vehicles!appointments_vehicle_id_fkey(category, category_label, brand, model)",
    )
    .eq("id", id)
    .maybeSingle<Row>()
  if (!row || !row.client) return null

  const [lines, payments, notes, history, price] = await Promise.all([
    supabase
      .from("appointment_vehicles")
      .select("position, category, price_applied, vehicle:vehicles(category, category_label, brand, model)")
      .eq("appointment_id", id)
      .order("position")
      .returns<LineRow[]>(),
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, kind")
      .eq("appointment_id", id)
      .is("voided_at", null)
      .order("paid_at", { ascending: true }),
    supabase
      .from("appointment_notes")
      .select("id, body, author_email, created_at")
      .eq("appointment_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("status_history")
      .select("from_status, to_status, changed_at")
      .eq("entity", "appointment")
      .eq("entity_id", id)
      .order("changed_at", { ascending: false }),
    supabase.rpc("appointment_final_price", { p_id: id }),
  ])

  let vehicles: FichaVehicle[] = (lines.data ?? []).map((l) => ({
    position: l.position,
    category: l.category ?? l.vehicle?.category ?? "auto",
    categoryLabel: l.vehicle?.category_label ?? null,
    brand: l.vehicle?.brand ?? null,
    model: l.vehicle?.model ?? null,
    price: l.price_applied,
  }))
  if (vehicles.length === 0 && row.legacy_vehicle) {
    vehicles = [
      {
        position: 0,
        category: row.legacy_vehicle.category,
        categoryLabel: row.legacy_vehicle.category_label,
        brand: row.legacy_vehicle.brand,
        model: row.legacy_vehicle.model,
        price: null,
      },
    ]
  }

  const paymentList: FichaPayment[] = (payments.data ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.method,
    paidAt: p.paid_at,
    kind: p.kind ?? "servicio",
  }))

  return {
    id: row.id,
    status: row.status,
    paymentStatus: row.payment_status ?? "pendiente",
    service: row.service,
    start: row.confirmed_start ?? row.requested_start,
    durationMinutes: row.duration_minutes ?? 60,
    address: row.address,
    neighborhood: row.neighborhood,
    operator: row.operator,
    contactName: row.contact_name,
    cancelReason: row.cancel_reason,
    discount: Number(row.discount ?? 0),
    finalPrice: Number(price.data ?? 0),
    paid: paymentList.filter((p) => p.kind === "servicio").reduce((sum, p) => sum + p.amount, 0),
    createdAt: row.created_at,
    client: {
      id: row.client.id,
      fullName: row.client.full_name,
      whatsapp: row.client.whatsapp,
      email: row.client.email,
    },
    vehicles,
    payments: paymentList,
    notes: (notes.data ?? []).map((n) => ({ id: n.id, body: n.body, authorEmail: n.author_email, createdAt: n.created_at })),
    history: (history.data ?? []).map((h) => ({ from: h.from_status, to: h.to_status, at: h.changed_at })),
  }
}
