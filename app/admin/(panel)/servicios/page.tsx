import type { Metadata } from "next"
import {
  Badge,
  EmptyState,
  ExportLink,
  Field,
  FilterBar,
  PageHeader,
  SectionTitle,
  Stat,
  TableWrap,
  TextLink,
  fieldClass,
  tdClass,
  thClass,
} from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDateTime, money, resolveRange } from "@/lib/admin/format"
import { PAYMENT_STATUS, VEHICLE_CATEGORY, paymentTone } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Servicios" }

type ServiceRow = {
  id: string
  appointment_id: string | null
  performed_at: string
  vehicle_category: string | null
  wash_type: string
  agreed_price: number | null
  final_price: number
  amount_paid: number
  payment_status: string
  operator: string | null
  notes: string | null
  clients: { id: string; full_name: string } | null
}

type AwaitingRow = {
  id: string
  confirmed_start: string
  service: string
  address: string
  clients: { full_name: string } | null
}

type SearchParams = Promise<{ desde?: string; hasta?: string; pago?: string }>

export default async function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const range = resolveRange(params, 90)

  let query = supabase
    .from("services")
    .select(
      "id, appointment_id, performed_at, vehicle_category, wash_type, agreed_price, final_price, amount_paid, payment_status, operator, notes, clients(id, full_name)",
    )
    .gte("performed_at", range.fromISO)
    .lt("performed_at", range.toISO)
    .order("performed_at", { ascending: false })
    .limit(500)
  if (params.pago && PAYMENT_STATUS[params.pago]) query = query.eq("payment_status", params.pago)

  const [{ data: services }, { data: awaiting }] = await Promise.all([
    query.returns<ServiceRow[]>(),
    supabase
      .from("appointments")
      .select("id, confirmed_start, service, address, clients(full_name)")
      .eq("status", "confirmado")
      .lt("confirmed_start", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .order("confirmed_start", { ascending: true })
      .returns<AwaitingRow[]>(),
  ])

  const rows = services ?? []
  const billed = rows.reduce((sum, s) => sum + Number(s.final_price), 0)
  const paid = rows.reduce((sum, s) => sum + Number(s.amount_paid), 0)

  return (
    <>
      <PageHeader
        title="Servicios"
        description="Lavados realizados. Para registrar uno nuevo, abrí el turno confirmado y marcalo como realizado."
        actions={<ExportLink entity="servicios" query={{ desde: range.from, hasta: range.to }} />}
      />

      <section className="flex flex-col gap-3">
        <SectionTitle>Turnos confirmados para cerrar</SectionTitle>
        {awaiting?.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {awaiting.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
                <TextLink href={`/admin/turnos/${a.id}`}>{a.clients?.full_name ?? "Cliente"}</TextLink>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatDateTime(a.confirmed_start)} · {a.service}
                </span>
                <span className="text-sm text-muted-foreground">{a.address}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No hay turnos confirmados pendientes de cerrar.</EmptyState>
        )}
      </section>

      <FilterBar resetHref="/admin/servicios">
        <Field label="Desde" htmlFor="desde" className="md:w-44">
          <input id="desde" name="desde" type="date" defaultValue={range.from} className={fieldClass} />
        </Field>
        <Field label="Hasta" htmlFor="hasta" className="md:w-44">
          <input id="hasta" name="hasta" type="date" defaultValue={range.to} className={fieldClass} />
        </Field>
        <Field label="Estado de pago" htmlFor="pago" className="md:w-44">
          <select id="pago" name="pago" defaultValue={params.pago ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            {Object.entries(PAYMENT_STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Lavados" value={rows.length} />
        <Stat label="Facturado (precio final)" value={money(billed)} />
        <Stat label="Cobrado de estos lavados" value={money(paid)} />
      </dl>

      {rows.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th className={thClass}>Fecha</th>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Lavado</th>
              <th className={thClass}>Operario</th>
              <th className={`${thClass} text-right`}>Acordado</th>
              <th className={`${thClass} text-right`}>Final</th>
              <th className={`${thClass} text-right`}>Saldo</th>
              <th className={thClass}>Pago</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="transition hover:bg-sky/40">
                <td className={`${tdClass} tabular-nums`}>
                  {s.appointment_id ? <TextLink href={`/admin/turnos/${s.appointment_id}`}>{formatDateTime(s.performed_at)}</TextLink> : formatDateTime(s.performed_at)}
                </td>
                <td className={tdClass}>
                  {s.clients ? <TextLink href={`/admin/clientes/${s.clients.id}`}>{s.clients.full_name}</TextLink> : "—"}
                </td>
                <td className={tdClass}>
                  <p>{s.wash_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.vehicle_category ? VEHICLE_CATEGORY[s.vehicle_category] : ""}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </p>
                </td>
                <td className={tdClass}>{s.operator ?? "—"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{s.agreed_price != null ? money(s.agreed_price) : "—"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{money(s.final_price)}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{money(Number(s.final_price) - Number(s.amount_paid))}</td>
                <td className={tdClass}>
                  <Badge tone={paymentTone(s.payment_status)}>{PAYMENT_STATUS[s.payment_status] ?? s.payment_status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState>No hay servicios realizados en el período.</EmptyState>
      )}
    </>
  )
}
