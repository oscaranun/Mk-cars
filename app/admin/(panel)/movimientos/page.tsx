import type { Metadata } from "next"
import Link from "next/link"
import { Pencil } from "lucide-react"
import { PaymentMethodForm } from "@/components/admin/payment-method-form"
import {
  Badge,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  Stat,
  TableWrap,
  TextLink,
  fieldClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { activePayments } from "@/lib/admin/payments"
import { formatDate, money, resolveRange, sanitizeSearch } from "@/lib/admin/format"
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Movimientos" }

type PaymentRow = {
  id: string
  amount: number
  method: string
  paid_at: string
  notes: string | null
  services: { wash_type: string; clients: { id: string; full_name: string } | null } | null
  appointments: { clients: { id: string; full_name: string } | null } | null
}

type ExpenseRow = {
  id: string
  amount: number
  method: string
  category: string
  description: string | null
  spent_on: string
}

type Movement =
  | { kind: "ingreso"; id: string; date: string; amount: number; method: string; title: string; detail: string; clientId: string | null }
  | { kind: "gasto"; id: string; date: string; amount: number; method: string; title: string; detail: string }

type SearchParams = Promise<{ desde?: string; hasta?: string; tipo?: string; medio?: string; categoria?: string; q?: string }>

export default async function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const range = resolveRange(params, 30)
  const type = params.tipo === "ingresos" || params.tipo === "gastos" ? params.tipo : "todos"
  const method = params.medio && PAYMENT_METHOD[params.medio] ? params.medio : ""
  const category = params.categoria && EXPENSE_CATEGORY[params.categoria] ? params.categoria : ""
  const search = sanitizeSearch(params.q).toLowerCase()

  const [{ data: payments }, { data: expenses }] = await Promise.all([
    type === "gastos" || category
      ? Promise.resolve({ data: [] as PaymentRow[] })
      : activePayments((excludeVoided) => {
          let q = supabase
            .from("payments")
            .select("id, amount, method, paid_at, notes, services(wash_type, clients(id, full_name)), appointments(clients(id, full_name))")
            .gte("paid_at", range.fromISO)
            .lt("paid_at", range.toISO)
            .order("paid_at", { ascending: false })
            .limit(2000)
          if (method) q = q.eq("method", method)
          if (excludeVoided) q = q.is("voided_at", null)
          return q.returns<PaymentRow[]>()
        }),
    type === "ingresos"
      ? Promise.resolve({ data: [] as ExpenseRow[] })
      : activePayments((excludeVoided) => {
          let q = supabase
            .from("expenses")
            .select("id, amount, method, category, description, spent_on")
            .gte("spent_on", range.from)
            .lte("spent_on", range.to)
            .order("spent_on", { ascending: false })
            .limit(2000)
          if (method) q = q.eq("method", method)
          if (category) q = q.eq("category", category)
          if (excludeVoided) q = q.is("voided_at", null)
          return q.returns<ExpenseRow[]>()
        }),
  ])

  const movements: Movement[] = [
    ...(payments ?? []).map((p): Movement => ({
      kind: "ingreso",
      id: p.id,
      date: p.paid_at,
      amount: Number(p.amount),
      method: p.method,
      title: p.services?.clients?.full_name ?? p.appointments?.clients?.full_name ?? "Cliente",
      detail: [p.services?.wash_type, p.notes].filter(Boolean).join(" · "),
      clientId: p.services?.clients?.id ?? p.appointments?.clients?.id ?? null,
    })),
    ...(expenses ?? []).map((e): Movement => ({
      kind: "gasto",
      id: e.id,
      date: `${e.spent_on}T12:00:00-03:00`,
      amount: Number(e.amount),
      method: e.method,
      title: EXPENSE_CATEGORY[e.category] ?? e.category,
      detail: e.description ?? "",
    })),
  ]
    .filter((m) => !search || `${m.title} ${m.detail}`.toLowerCase().includes(search))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalIn = movements.filter((m) => m.kind === "ingreso").reduce((s, m) => s + m.amount, 0)
  const totalOut = movements.filter((m) => m.kind === "gasto").reduce((s, m) => s + m.amount, 0)
  const countIn = movements.filter((m) => m.kind === "ingreso").length

  return (
    <>
      <PageHeader
        title="Movimientos"
        description={`Ingresos y gastos del ${formatDate(`${range.from}T12:00:00-03:00`)} al ${formatDate(`${range.to}T12:00:00-03:00`)}.`}
      />

      <FilterBar resetHref="/admin/movimientos">
        <Field label="Desde" htmlFor="desde" className="md:w-44">
          <input id="desde" name="desde" type="date" defaultValue={range.from} className={fieldClass} />
        </Field>
        <Field label="Hasta" htmlFor="hasta" className="md:w-44">
          <input id="hasta" name="hasta" type="date" defaultValue={range.to} className={fieldClass} />
        </Field>
        <Field label="Tipo" htmlFor="tipo" className="md:w-40">
          <select id="tipo" name="tipo" defaultValue={type} className={fieldClass}>
            <option value="todos">Todos</option>
            <option value="ingresos">Solo ingresos</option>
            <option value="gastos">Solo gastos</option>
          </select>
        </Field>
        <Field label="Medio" htmlFor="medio" className="md:w-40">
          <select id="medio" name="medio" defaultValue={method} className={fieldClass}>
            <option value="">Todos</option>
            {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Categoría de gasto" htmlFor="categoria" className="md:w-44">
          <select id="categoria" name="categoria" defaultValue={category} className={fieldClass}>
            <option value="">Todas</option>
            {Object.entries(EXPENSE_CATEGORY).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Buscar" htmlFor="q" className="md:min-w-48 md:flex-1">
          <input id="q" name="q" type="search" defaultValue={params.q ?? ""} placeholder="Cliente, servicio o detalle" className={fieldClass} />
        </Field>
      </FilterBar>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Ingresos" value={money(totalIn)} hint={`${countIn} cobro${countIn === 1 ? "" : "s"}`} />
        <Stat
          label="Gastos"
          value={money(totalOut)}
          hint={`${movements.length - countIn} gasto${movements.length - countIn === 1 ? "" : "s"}`}
        />
        <Stat label="Resultado" value={money(totalIn - totalOut)} />
        <Stat label="Movimientos" value={String(movements.length)} />
      </dl>

      {movements.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th className={thClass}>Fecha</th>
              <th className={thClass}>Tipo</th>
              <th className={thClass}>Detalle</th>
              <th className={thClass}>Medio</th>
              <th className={`${thClass} text-right`}>Importe</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={`${m.kind}-${m.id}`}>
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatDate(m.date)}</td>
                <td className={tdClass}>
                  <Badge tone={m.kind === "ingreso" ? "success" : "danger"}>{m.kind === "ingreso" ? "Ingreso" : "Gasto"}</Badge>
                </td>
                <td className={tdClass}>
                  {m.kind === "ingreso" && m.clientId ? (
                    <TextLink href={`/admin/clientes/${m.clientId}`}>{m.title}</TextLink>
                  ) : (
                    <span className="font-medium">{m.title}</span>
                  )}
                  {m.detail && <p className="text-xs text-muted-foreground">{m.detail}</p>}
                </td>
                <td className={tdClass}>
                  {m.kind === "ingreso" ? (
                    <PaymentMethodForm paymentId={m.id} method={m.method} />
                  ) : (
                    PAYMENT_METHOD[m.method] ?? m.method
                  )}
                </td>
                <td className={cn(tdClass, "text-right tabular-nums")}>
                  <div className="flex items-center justify-end gap-2">
                    <span className={cn("font-semibold", m.kind === "gasto" ? "text-red-400" : "text-emerald-300")}>
                      {m.kind === "gasto" ? "−" : "+"}
                      {money(m.amount)}
                    </span>
                    <Link
                      href={`/admin/movimientos/${m.kind === "ingreso" ? "ingreso" : "egreso"}/${m.id}`}
                      className={cn(secondaryButtonClass, "size-11 px-0")}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      <span className="sr-only">Editar {m.kind === "ingreso" ? "ingreso" : "gasto"}</span>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState>No hay movimientos con estos filtros.</EmptyState>
      )}
    </>
  )
}
