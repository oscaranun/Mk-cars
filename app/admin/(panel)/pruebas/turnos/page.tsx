import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { Badge, EmptyState, PageHeader } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDateTime, money } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, PAYMENT_STATUS, appointmentTone, paymentTone } from "@/lib/admin/labels"

export const metadata = { title: "Turnos (prueba) | MK Cars" }

type Row = {
  id: string
  status: string
  payment_status: string | null
  service: string
  requested_start: string | null
  confirmed_start: string | null
  agreed_price: number | null
  contact_name: string | null
  client: { full_name: string } | null
}

export default async function PruebaTurnosPage() {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("appointments")
    .select("id, status, payment_status, service, requested_start, confirmed_start, agreed_price, contact_name, client:clients!inner(full_name)")
    .eq("client.is_demo", true)
    .order("requested_start", { ascending: true, nullsFirst: false })
    .limit(100)
    .returns<Row[]>()

  const now = Date.now()
  const rows = (data ?? []).map((r) => ({ ...r, start: r.confirmed_start ?? r.requested_start }))
  const upcoming = rows.filter((r) => r.start && new Date(r.start).getTime() >= now)
  const past = rows.filter((r) => !r.start || new Date(r.start).getTime() < now).reverse()

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/pruebas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Panel de pruebas
      </Link>
      <PageHeader
        title="Turnos — ficha simplificada"
        description="Solo clientes de prueba. Tocá un turno para abrir la ficha: estado, vehículos, pagos y notas en un solo lugar."
      />
      <TurnoList title={`Próximos (${upcoming.length})`} rows={upcoming} />
      <TurnoList title={`Pasados (${past.length})`} rows={past} />
    </div>
  )
}

function TurnoList({ title, rows }: { title: string; rows: (Row & { start: string | null })[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState>No hay turnos.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/pruebas/turnos/${r.id}`} className="flex items-center gap-3 p-4 transition hover:bg-surface/60">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.contact_name || r.client?.full_name}</span>
                    <Badge tone={appointmentTone(r.status)}>{APPOINTMENT_STATUS[r.status] ?? r.status}</Badge>
                    <Badge tone={paymentTone(r.payment_status ?? "pendiente")}>
                      {PAYMENT_STATUS[r.payment_status ?? "pendiente"]}
                    </Badge>
                  </div>
                  <span className="truncate text-sm text-muted-foreground">
                    {r.start ? formatDateTime(r.start) : "Sin fecha"} · {r.service}
                    {r.agreed_price ? ` · ${money(r.agreed_price)}` : ""}
                  </span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
