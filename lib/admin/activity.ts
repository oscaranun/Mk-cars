export type ActivityChange = { field: string; from: string | null; to: string | null }

export type ActivityEntry = {
  id: number
  actor_id: string | null
  actor_email: string | null
  actor_name: string | null
  entity: string
  entity_id: string | null
  action: string
  detail: string | null
  changes: ActivityChange[] | null
  created_at: string
}

export const ENTITY_LABEL: Record<string, string> = {
  clients: "Cliente",
  vehicles: "Vehículo",
  appointments: "Turno",
  inquiries: "Consulta",
  services: "Servicio",
  payments: "Cobro",
  expenses: "Gasto",
  blocked_dates: "Día bloqueado",
  appointment_offers: "Propuesta",
  appointment_notes: "Nota de turno",
  client_contacts: "Contacto con cliente",
  settings: "Ajustes",
  vehicle_catalog: "Catálogo de vehículos",
  admins: "Usuario del panel",
}

export function entityLabel(entity: string) {
  return ENTITY_LABEL[entity] ?? entity.charAt(0).toUpperCase() + entity.slice(1)
}

const FIELD_LABEL: Record<string, string> = {
  status: "estado",
  commercial_status: "estado comercial",
  payment_status: "estado de pago",
  confirmed_start: "fecha confirmada",
  requested_start: "fecha pedida",
  duration_minutes: "duración",
  agreed_price: "precio acordado",
  final_price: "precio final",
  amount_paid: "pagado",
  amount: "monto",
  discount: "descuento",
  address: "dirección",
  neighborhood: "barrio",
  service: "servicio",
  extras: "extras",
  operator: "operario",
  contact_name: "nombre",
  full_name: "nombre",
  whatsapp: "WhatsApp",
  email: "email",
  notes: "notas",
  plate: "patente",
  brand: "marca",
  model: "modelo",
  category: "categoría",
  method: "medio de pago",
  cancel_reason: "motivo de cancelación",
  archived_at: "archivado",
  archive_reason: "motivo de archivo",
  follow_up_at: "recontactar el",
  follow_up_note: "nota de seguimiento",
  service_prices: "lista de precios",
  vehicle_prices: "precios por vehículo",
  loyalty_every: "fidelidad",
  role: "rol",
  permissions: "permisos",
  voided_at: "anulado",
  void_reason: "motivo de anulación",
}

export function fieldLabel(field: string) {
  return FIELD_LABEL[field] ?? field.replace(/_/g, " ")
}

export function actorName(entry: Pick<ActivityEntry, "actor_name" | "actor_email">) {
  return entry.actor_name?.trim() || entry.actor_email?.split("@")[0] || "Sistema"
}

export function initials(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export function shortValue(value: string | null) {
  if (value === null || value === "") return "—"
  return value.length > 40 ? `${value.slice(0, 40)}…` : value
}
