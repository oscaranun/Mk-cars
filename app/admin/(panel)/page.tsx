import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Stat } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDateTime, money, resolveRange } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, appointmentTone } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Resumen" }

type ApptRow = {
  id: string
  requested_start: string
  confirmed_start: string | null
  address: string
  service: string
  status: string
  clients: { full_name: string } | null
}

export default async function AdminSummaryPage() {
  const { supabase } = await requireAdmin()
  const range = resolveRange({}, 30)
  const nowISO = new Date().toISOString()

  const [inquiries, clients, pending, upcoming, payments, balances] = await Promise.all([
    supabase.from("inquiries").select("id", { count: "exact", head: true }).gte("created_at", range.fromISO),
    supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", range.fromISO),
    supabase
      .from("appointments")
      .select("id, requested_start, confirmed_start, address, service, status, clients(full_name)")
      .in("status", ["solicitado", "reprogramado"])
      .order("requested_start", { ascending: true })
      .limit(20)
      .returns<ApptRow[]>(),
    supabase
      .from("appointments")
      .select("id, requested_start, confirmed_start, address, service, status, clients(full_name)")
      .eq("status", "confirmado")
      .gte("confirmed_start", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
      .order("confirmed_start", { ascending: true })
      .limit(10)
      .returns<ApptRow[]>(),
    supabase.from("payments").select("amount").gte("paid_at", range.fromISO).lt("paid_at", range.toISO),
    supabase.from("services").select("final_price, amount_paid").neq("payment_status", "cobrado"),
  ])

  const collected = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const outstanding = (balances.data ?? []).reduce((sum, s) => sum + Number(s.final_price) - Number(s.amount_paid), 0)

  return (
    <>
      <PageHeader title="Resumen" description={`Últimos 30 días · actualizado ${formatDateTime(nowISO)}`} />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Consultas" value={inquiries.count ?? 0} />
        <Stat label="Clientes nuevos" value={clients.count ?? 0} />
        <Stat label="Por confirmar" value={pending.data?.length ?? 0} />
        <Stat label="Próximos confirmados" value={upcoming.data?.length ?? 0} />
        <Stat label="Cobrado" value={money(collected)} />
        <Stat label="Saldo pendiente" value={money(outstanding)} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <AppointmentList
          title="Solicitudes por confirmar"
          empty="No hay solicitudes pendientes."
          items={pending.data ?? []}
          dateOf={(a) => a.requested_start}
        />
        <AppointmentList
          title="Próximos turnos confirmados"
          empty="No hay turnos confirmados próximos."
          items={upcoming.data ?? []}
          dateOf={(a) => a.confirmed_start ?? a.requested_start}
        />
      </div>
    </>
  )
}

function AppointmentList({
  title,
  empty,
  items,
  dateOf,
}: {
  title: string
  empty: string
  items: ApptRow[]
  dateOf: (a: ApptRow) => string
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        aside={
          <Link href="/admin/turnos" className="inline-flex items-center gap-1 text-sm text-electric hover:underline">
            Ver turnos <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        {title}
      </SectionTitle>
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/turnos/${a.id}`} className="block">
                <Card className="flex flex-col gap-1 p-4 transition hover:border-electric/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{a.clients?.full_name ?? "Cliente"}</span>
                    <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS[a.status] ?? a.status}</Badge>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatDateTime(dateOf(a))} · {a.service}
                  </span>
                  <span className="text-sm text-muted-foreground">{a.address}</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{empty}</EmptyState>
      )}
    </section>
  )
}
