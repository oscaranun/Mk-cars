import type { Metadata } from "next"
import { addPayment } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import {
  Badge,
  Card,
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
import { formatDate, formatDateTime, money, resolveRange, todayArgentina } from "@/lib/admin/format"
import { PAYMENT_METHOD, PAYMENT_STATUS, paymentTone } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Cobros" }

type OpenService = {
  id: string
  performed_at: string
  wash_type: string
  final_price: number
  amount_paid: number
  payment_status: string
  clients: { id: string; full_name: string } | null
}

type PaymentRow = {
  id: string
  amount: number
  method: string
  paid_at: string
  notes: string | null
  services: { wash_type: string; clients: { id: string; full_name: string } | null } | null
}

type SearchParams = Promise<{ desde?: string; hasta?: string; medio?: string; servicio?: string }>

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const range = resolveRange(params, 30)
  const today = todayArgentina()

  let paymentsQuery = supabase
    .from("payments")
    .select("id, amount, method, paid_at, notes, services(wash_type, clients(id, full_name))")
    .gte("paid_at", range.fromISO)
    .lt("paid_at", range.toISO)
    .order("paid_at", { ascending: false })
    .limit(1000)
  if (params.medio && PAYMENT_METHOD[params.medio]) paymentsQuery = paymentsQuery.eq("method", params.medio)

  const [{ data: open }, { data: payments }] = await Promise.all([
    supabase
      .from("services")
      .select("id, performed_at, wash_type, final_price, amount_paid, payment_status, clients(id, full_name)")
      .neq("payment_status", "cobrado")
      .order("performed_at", { ascending: true })
      .returns<OpenService[]>(),
    paymentsQuery.returns<PaymentRow[]>(),
  ])

  const openRows = (open ?? []).filter((s) => Number(s.final_price) - Number(s.amount_paid) > 0)
  const collected = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const outstanding = openRows.reduce((sum, s) => sum + Number(s.final_price) - Number(s.amount_paid), 0)
  const byMethod = Object.keys(PAYMENT_METHOD).map((m) => ({
    method: m,
    total: (payments ?? []).filter((p) => p.method === m).reduce((sum, p) => sum + Number(p.amount), 0),
  }))

  return (
    <>
      <PageHeader
        title="Cobros"
        description="La facturación cobrada suma solo pagos registrados. Los saldos pendientes no se cuentan."
        actions={<ExportLink entity="cobros" query={{ desde: range.from, hasta: range.to }} />}
      />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Cobrado en el período" value={money(collected)} />
        {byMethod.map((m) => (
          <Stat key={m.method} label={PAYMENT_METHOD[m.method]} value={money(m.total)} />
        ))}
        <Stat label="Saldo pendiente total" value={money(outstanding)} hint={`${openRows.length} servicio${openRows.length === 1 ? "" : "s"}`} />
      </dl>

      <section className="flex flex-col gap-3">
        <SectionTitle>Saldos pendientes</SectionTitle>
        {openRows.length ? (
          <ul className="flex flex-col gap-3">
            {openRows.map((s) => {
              const balance = Number(s.final_price) - Number(s.amount_paid)
              return (
                <li key={s.id}>
                  <Card className={cn("flex flex-col gap-4", params.servicio === s.id && "border-electric")}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        {s.clients ? <TextLink href={`/admin/clientes/${s.clients.id}`}>{s.clients.full_name}</TextLink> : <span>Cliente</span>}
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {formatDateTime(s.performed_at)} · {s.wash_type}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={paymentTone(s.payment_status)}>{PAYMENT_STATUS[s.payment_status]}</Badge>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {money(s.amount_paid)} de {money(s.final_price)}
                        </span>
                        <span className="text-base font-semibold tabular-nums">Saldo {money(balance)}</span>
                      </div>
                    </div>
                    <ActionForm action={addPayment} submitLabel="Registrar pago" inline resetOnSuccess className="border-t border-border pt-4">
                      <input type="hidden" name="service_id" value={s.id} />
                      <Field label="Importe" htmlFor={`amount-${s.id}`} className="w-36">
                        <input id={`amount-${s.id}`} name="amount" inputMode="decimal" required defaultValue={balance} className={fieldClass} />
                      </Field>
                      <Field label="Fecha de pago" htmlFor={`date-${s.id}`} className="w-44">
                        <input id={`date-${s.id}`} name="date" type="date" required max={today} defaultValue={today} className={fieldClass} />
                      </Field>
                      <Field label="Medio" htmlFor={`method-${s.id}`} className="w-40">
                        <select id={`method-${s.id}`} name="method" required defaultValue="efectivo" className={fieldClass}>
                          {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Nota" htmlFor={`notes-${s.id}`} className="min-w-40 flex-1">
                        <input id={`notes-${s.id}`} name="notes" placeholder="Opcional" className={fieldClass} />
                      </Field>
                    </ActionForm>
                  </Card>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState>No hay saldos pendientes.</EmptyState>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Pagos registrados</SectionTitle>
        <FilterBar resetHref="/admin/cobros">
          <Field label="Desde" htmlFor="desde" className="md:w-44">
            <input id="desde" name="desde" type="date" defaultValue={range.from} className={fieldClass} />
          </Field>
          <Field label="Hasta" htmlFor="hasta" className="md:w-44">
            <input id="hasta" name="hasta" type="date" defaultValue={range.to} className={fieldClass} />
          </Field>
          <Field label="Medio" htmlFor="medio" className="md:w-40">
            <select id="medio" name="medio" defaultValue={params.medio ?? ""} className={fieldClass}>
              <option value="">Todos</option>
              {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </FilterBar>

        {payments?.length ? (
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>Servicio</th>
                <th className={thClass}>Medio</th>
                <th className={`${thClass} text-right`}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className={`${tdClass} tabular-nums`}>{formatDate(p.paid_at)}</td>
                  <td className={tdClass}>
                    {p.services?.clients ? (
                      <TextLink href={`/admin/clientes/${p.services.clients.id}`}>{p.services.clients.full_name}</TextLink>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={tdClass}>
                    {p.services?.wash_type ?? "—"}
                    {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                  </td>
                  <td className={tdClass}>{PAYMENT_METHOD[p.method] ?? p.method}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState>No hay pagos en el período.</EmptyState>
        )}
      </section>
    </>
  )
}
