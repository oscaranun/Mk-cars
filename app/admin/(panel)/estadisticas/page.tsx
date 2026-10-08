import type { Metadata } from "next"
import { Card, EmptyState, Field, FilterBar, PageHeader, SectionTitle, Stat, fieldClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { money, resolveRange } from "@/lib/admin/format"
import { CONVERTED_INQUIRY_STATUSES, INQUIRY_STATUS, PAYMENT_METHOD, VEHICLE_CATEGORY } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Estadísticas" }

type SearchParams = Promise<{ desde?: string; hasta?: string }>

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const map = new Map<string, number>()
  for (const item of items) {
    const k = key(item) || "Sin dato"
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export default async function StatsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const range = resolveRange(params, 30)

  const [inquiries, newClients, services, payments, allServices, outstanding] = await Promise.all([
    supabase.from("inquiries").select("commercial_status, source").gte("created_at", range.fromISO).lt("created_at", range.toISO).limit(5000),
    supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", range.fromISO).lt("created_at", range.toISO),
    supabase
      .from("services")
      .select("final_price, vehicle_category, wash_type")
      .gte("performed_at", range.fromISO)
      .lt("performed_at", range.toISO)
      .limit(5000),
    supabase.from("payments").select("amount, method").gte("paid_at", range.fromISO).lt("paid_at", range.toISO).limit(5000),
    supabase.from("services").select("client_id").limit(10000),
    supabase.from("services").select("final_price, amount_paid").neq("payment_status", "cobrado").limit(5000),
  ])

  const inq = inquiries.data ?? []
  const svc = services.data ?? []
  const pay = payments.data ?? []

  const converted = inq.filter((i) => CONVERTED_INQUIRY_STATUSES.includes(i.commercial_status)).length
  const conversion = inq.length ? Math.round((converted / inq.length) * 100) : 0
  const collected = pay.reduce((sum, p) => sum + Number(p.amount), 0)
  const billed = svc.reduce((sum, s) => sum + Number(s.final_price), 0)
  const avgTicket = svc.length ? billed / svc.length : 0
  const pendingBalance = (outstanding.data ?? []).reduce((sum, s) => sum + Number(s.final_price) - Number(s.amount_paid), 0)

  const washesPerClient = countBy(allServices.data ?? [], (s) => s.client_id)
  const recurring = washesPerClient.filter(([, n]) => n >= 2).length
  const withWashes = washesPerClient.length

  const bySource = countBy(inq, (i) => i.source)
  const byStatus = countBy(inq, (i) => INQUIRY_STATUS[i.commercial_status] ?? i.commercial_status)
  const byVehicle = countBy(svc, (s) => (s.vehicle_category ? VEHICLE_CATEGORY[s.vehicle_category] : null))
  const byWash = countBy(svc, (s) => s.wash_type)
  const byMethod = Object.keys(PAYMENT_METHOD).map(
    (m) => [PAYMENT_METHOD[m], pay.filter((p) => p.method === m).reduce((sum, p) => sum + Number(p.amount), 0)] as [string, number],
  )

  return (
    <>
      <PageHeader title="Estadísticas" description="Calculadas en vivo sobre los datos cargados en el panel." />

      <FilterBar resetHref="/admin/estadisticas">
        <Field label="Desde" htmlFor="desde" className="md:w-44">
          <input id="desde" name="desde" type="date" defaultValue={range.from} className={fieldClass} />
        </Field>
        <Field label="Hasta" htmlFor="hasta" className="md:w-44">
          <input id="hasta" name="hasta" type="date" defaultValue={range.to} className={fieldClass} />
        </Field>
      </FilterBar>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Consultas" value={inq.length} />
        <Stat label="Conversión" value={`${conversion}%`} hint={`${converted} convertida${converted === 1 ? "" : "s"}`} />
        <Stat label="Clientes nuevos" value={newClients.count ?? 0} />
        <Stat label="Lavados realizados" value={svc.length} />
        <Stat label="Facturación cobrada" value={money(collected)} hint="Solo pagos registrados" />
        <Stat label="Ticket promedio" value={money(avgTicket)} hint="Precio final por lavado" />
        <Stat label="Saldo pendiente" value={money(pendingBalance)} hint="Total actual" />
        <Stat label="Clientes recurrentes" value={recurring} hint={`de ${withWashes} con al menos un lavado`} />
      </dl>

      <div className="grid gap-6 md:grid-cols-2">
        <Breakdown title="Consultas por origen" rows={bySource} />
        <Breakdown title="Consultas por estado" rows={byStatus} />
        <Breakdown title="Lavados por tipo de vehículo" rows={byVehicle} />
        <Breakdown title="Lavados por tipo de servicio" rows={byWash} />
        <Breakdown title="Cobrado por medio de pago" rows={byMethod} format={money} />
      </div>
    </>
  )
}

function Breakdown({
  title,
  rows,
  format = (n: number) => String(n),
}: {
  title: string
  rows: [string, number][]
  format?: (n: number) => string
}) {
  const max = Math.max(1, ...rows.map(([, n]) => n))
  const hasData = rows.some(([, n]) => n > 0)
  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle>{title}</SectionTitle>
      {hasData ? (
        <ul className="flex flex-col gap-3">
          {rows.map(([label, n]) => (
            <li key={label} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{label}</span>
                <span className="tabular-nums text-muted-foreground">{format(n)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>Sin datos en el período.</EmptyState>
      )}
    </Card>
  )
}
