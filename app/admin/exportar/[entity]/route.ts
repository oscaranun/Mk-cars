import type { NextRequest } from "next/server"
import { getAdminClient } from "@/lib/admin/auth"
import { argentinaParts, resolveRange } from "@/lib/admin/format"
import {
  APPOINTMENT_STATUS,
  INQUIRY_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  VEHICLE_CATEGORY,
} from "@/lib/admin/labels"

type Row = Record<string, string | number | boolean | null | undefined>

/** Leading =,+,-,@ are neutralised so spreadsheet apps don't evaluate cell contents as formulas. */
function cell(value: Row[string]) {
  if (value === null || value === undefined) return ""
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: Row[], headers: [string, string][]) {
  const lines = [headers.map(([, label]) => cell(label)).join(";")]
  for (const row of rows) lines.push(headers.map(([key]) => cell(row[key])).join(";"))
  return "\uFEFF" + lines.join("\r\n")
}

const dt = (v: string | null | undefined) => {
  if (!v) return ""
  const p = argentinaParts(v)
  return `${p.date} ${p.time}`
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params
  const supabase = await getAdminClient()
  if (!supabase) return new Response("No autorizado", { status: 401 })

  const sp = request.nextUrl.searchParams
  const range = resolveRange({ desde: sp.get("desde") ?? undefined, hasta: sp.get("hasta") ?? undefined }, 3650)
  let csv: string

  if (entity === "clientes") {
    const { data, error } = await supabase
      .from("clients")
      .select("full_name, whatsapp, email, source, created_at, last_interaction_at, marketing_consent, notes, services(amount_paid)")
      .order("created_at", { ascending: false })
      .limit(10000)
    if (error) return new Response("Error al exportar", { status: 500 })
    csv = toCsv(
      (data ?? []).map((c) => ({
        full_name: c.full_name,
        whatsapp: c.whatsapp,
        email: c.email,
        source: c.source,
        notes: c.notes,
        created_at: dt(c.created_at),
        last_interaction_at: dt(c.last_interaction_at),
        marketing_consent: c.marketing_consent ? "Sí" : "No",
        washes: c.services.length,
        paid: c.services.reduce((s: number, x: { amount_paid: number }) => s + Number(x.amount_paid), 0),
      })),
      [
        ["full_name", "Nombre"],
        ["whatsapp", "WhatsApp"],
        ["email", "Correo"],
        ["source", "Origen"],
        ["created_at", "Alta"],
        ["last_interaction_at", "Última interacción"],
        ["washes", "Lavados"],
        ["paid", "Total pagado"],
        ["marketing_consent", "Acepta promociones"],
        ["notes", "Notas"],
      ],
    )
  } else if (entity === "consultas") {
    const { data, error } = await supabase
      .from("inquiries")
      .select("created_at, service, extras, source, commercial_status, notes, clients(full_name, whatsapp)")
      .gte("created_at", range.fromISO)
      .lt("created_at", range.toISO)
      .order("created_at", { ascending: false })
      .limit(10000)
      .returns<
        { created_at: string; service: string; extras: string[] | null; source: string; commercial_status: string; notes: string | null; clients: { full_name: string; whatsapp: string } | null }[]
      >()
    if (error) return new Response("Error al exportar", { status: 500 })
    csv = toCsv(
      (data ?? []).map((i) => ({
        created_at: dt(i.created_at),
        client: i.clients?.full_name,
        whatsapp: i.clients?.whatsapp,
        service: i.service,
        extras: i.extras?.join(", "),
        source: i.source,
        status: INQUIRY_STATUS[i.commercial_status] ?? i.commercial_status,
        notes: i.notes,
      })),
      [
        ["created_at", "Fecha"],
        ["client", "Cliente"],
        ["whatsapp", "WhatsApp"],
        ["service", "Servicio"],
        ["extras", "Extras"],
        ["source", "Origen"],
        ["status", "Estado"],
        ["notes", "Comentarios"],
      ],
    )
  } else if (entity === "turnos") {
    const { data, error } = await supabase
      .from("appointments")
      .select("requested_start, confirmed_start, duration_minutes, service, address, status, agreed_price, operator, clients(full_name, whatsapp)")
      .order("requested_start", { ascending: false })
      .limit(10000)
      .returns<
        { requested_start: string; confirmed_start: string | null; duration_minutes: number; service: string; address: string; status: string; agreed_price: number | null; operator: string | null; clients: { full_name: string; whatsapp: string } | null }[]
      >()
    if (error) return new Response("Error al exportar", { status: 500 })
    csv = toCsv(
      (data ?? []).map((a) => ({
        requested: dt(a.requested_start),
        confirmed: dt(a.confirmed_start),
        duration: a.duration_minutes,
        client: a.clients?.full_name,
        whatsapp: a.clients?.whatsapp,
        service: a.service,
        address: a.address,
        status: APPOINTMENT_STATUS[a.status] ?? a.status,
        price: a.agreed_price,
        operator: a.operator,
      })),
      [
        ["requested", "Fecha solicitada"],
        ["confirmed", "Fecha confirmada"],
        ["duration", "Duración (min)"],
        ["client", "Cliente"],
        ["whatsapp", "WhatsApp"],
        ["service", "Servicio"],
        ["address", "Domicilio"],
        ["status", "Estado"],
        ["price", "Precio acordado"],
        ["operator", "Operario"],
      ],
    )
  } else if (entity === "servicios") {
    const { data, error } = await supabase
      .from("services")
      .select("performed_at, vehicle_category, wash_type, agreed_price, final_price, amount_paid, payment_status, operator, notes, clients(full_name)")
      .gte("performed_at", range.fromISO)
      .lt("performed_at", range.toISO)
      .order("performed_at", { ascending: false })
      .limit(10000)
      .returns<
        { performed_at: string; vehicle_category: string | null; wash_type: string; agreed_price: number | null; final_price: number; amount_paid: number; payment_status: string; operator: string | null; notes: string | null; clients: { full_name: string } | null }[]
      >()
    if (error) return new Response("Error al exportar", { status: 500 })
    csv = toCsv(
      (data ?? []).map((s) => ({
        performed_at: dt(s.performed_at),
        client: s.clients?.full_name,
        vehicle: s.vehicle_category ? VEHICLE_CATEGORY[s.vehicle_category] : "",
        wash: s.wash_type,
        agreed: s.agreed_price,
        final: s.final_price,
        paid: s.amount_paid,
        balance: Number(s.final_price) - Number(s.amount_paid),
        status: PAYMENT_STATUS[s.payment_status] ?? s.payment_status,
        operator: s.operator,
        notes: s.notes,
      })),
      [
        ["performed_at", "Fecha"],
        ["client", "Cliente"],
        ["vehicle", "Vehículo"],
        ["wash", "Lavado"],
        ["agreed", "Precio acordado"],
        ["final", "Precio final"],
        ["paid", "Pagado"],
        ["balance", "Saldo"],
        ["status", "Estado de pago"],
        ["operator", "Operario"],
        ["notes", "Observaciones"],
      ],
    )
  } else if (entity === "cobros") {
    const { data, error } = await supabase
      .from("payments")
      .select("paid_at, amount, method, notes, services(wash_type, clients(full_name))")
      .gte("paid_at", range.fromISO)
      .lt("paid_at", range.toISO)
      .order("paid_at", { ascending: false })
      .limit(10000)
      .returns<
        { paid_at: string; amount: number; method: string; notes: string | null; services: { wash_type: string; clients: { full_name: string } | null } | null }[]
      >()
    if (error) return new Response("Error al exportar", { status: 500 })
    csv = toCsv(
      (data ?? []).map((p) => ({
        paid_at: argentinaParts(p.paid_at).date,
        client: p.services?.clients?.full_name,
        wash: p.services?.wash_type,
        method: PAYMENT_METHOD[p.method] ?? p.method,
        amount: p.amount,
        notes: p.notes,
      })),
      [
        ["paid_at", "Fecha"],
        ["client", "Cliente"],
        ["wash", "Servicio"],
        ["method", "Medio"],
        ["amount", "Importe"],
        ["notes", "Nota"],
      ],
    )
  } else {
    return new Response("No encontrado", { status: 404 })
  }

  const stamp = argentinaParts(new Date()).date
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mk-cars-${entity}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
