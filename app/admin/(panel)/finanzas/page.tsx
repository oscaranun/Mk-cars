import Link from "next/link"
import { Pencil, Search, X } from "lucide-react"
import { deleteFinanceConcept, deleteFinanceEntry, saveFinanceConcept } from "@/app/admin/(panel)/ficha-actions"
import { ActionForm } from "@/components/admin/action-form"
import { FinanceEditForm } from "@/components/admin/ficha/finance-edit-form"
import { FinanceForm, type FinanceConcept } from "@/components/admin/ficha/finance-form"
import { Card, EmptyState, PageHeader, SectionTitle, Stat, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDate, isValidDate, money, startOfArgentinaDay, todayArgentina } from "@/lib/admin/format"
import { PAYMENT_METHOD } from "@/lib/admin/labels"

export const metadata = { title: "Finanzas" }

type Movement = {
  key: string
  id: string
  type: "ingreso" | "gasto"
  source: "turno" | "manual"
  date: string
  day: string
  concept: string
  subconcept: string | null
  notes: string | null
  amount: number
  method: string | null
}

type Filters = { mes?: string; q?: string; tipo?: string; concepto?: string; sub?: string }

const SIN_SUB = "__sin"

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
  return { from: `${month}-01`, to: `${next}-01` }
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const today = todayArgentina()
  const allTime = params.mes === "todo"
  const month = !allTime && params.mes && isValidDate(`${params.mes}-01`) ? params.mes : today.slice(0, 7)
  const { from, to } = allTime ? { from: "2000-01-01", to: "2100-01-01" } : monthBounds(month)
  const q = (params.q ?? "").slice(0, 120)
  const tipo = params.tipo === "ingreso" || params.tipo === "gasto" ? params.tipo : ""
  const conceptFilter = (params.concepto ?? "").slice(0, 60)
  const subFilter = (params.sub ?? "").slice(0, 60)

  const [concepts, payments, others, expenses] = await Promise.all([
    supabase.from("finance_concepts").select("id, kind, name").order("name"),
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, kind, appointment:appointments(service, contact_name, client:clients(full_name))")
      .is("voided_at", null)
      .gte("paid_at", startOfArgentinaDay(from))
      .lt("paid_at", startOfArgentinaDay(to))
      .limit(5000),
    supabase
      .from("other_incomes")
      .select("id, received_on, concept, subconcept, notes, amount, method")
      .gte("received_on", from)
      .lt("received_on", to)
      .limit(5000),
    supabase
      .from("expenses")
      .select("id, spent_on, category, description, subconcept, notes, amount, method")
      .is("voided_at", null)
      .gte("spent_on", from)
      .lt("spent_on", to)
      .limit(5000),
  ])

  type PaymentRow = {
    id: string
    amount: number
    method: string
    paid_at: string
    kind: string | null
    appointment: { service: string; contact_name: string | null; client: { full_name: string } | null } | null
  }

  const all: Movement[] = [
    ...((payments.data ?? []) as unknown as PaymentRow[]).map((p) => ({
      key: `p-${p.id}`,
      id: p.id,
      type: "ingreso" as const,
      source: "turno" as const,
      date: p.paid_at,
      day: p.paid_at.slice(0, 10),
      concept: "Cobro de turno",
      subconcept: p.kind === "servicio" ? "Servicio" : "Adicional",
      notes: p.appointment?.contact_name || p.appointment?.client?.full_name || null,
      amount: Number(p.amount),
      method: p.method,
    })),
    ...(others.data ?? []).map((o) => ({
      key: `o-${o.id}`,
      id: o.id,
      type: "ingreso" as const,
      source: "manual" as const,
      date: `${o.received_on}T12:00:00-03:00`,
      day: o.received_on,
      concept: o.concept,
      subconcept: o.subconcept,
      notes: o.notes,
      amount: Number(o.amount),
      method: o.method,
    })),
    ...(expenses.data ?? []).map((e) => ({
      key: `e-${e.id}`,
      id: e.id,
      type: "gasto" as const,
      source: "manual" as const,
      date: `${e.spent_on}T12:00:00-03:00`,
      day: e.spent_on,
      concept: e.description || e.category,
      subconcept: e.subconcept,
      notes: e.notes,
      amount: Number(e.amount),
      method: e.method,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const terms = q
    .split(/[+,]/)
    .map((t) => normalize(t.trim()))
    .filter(Boolean)
  const movements = all.filter((m) => {
    if (tipo && m.type !== tipo) return false
    if (conceptFilter && m.concept !== conceptFilter) return false
    if (subFilter === SIN_SUB ? m.subconcept : subFilter && m.subconcept !== subFilter) return false
    if (terms.length === 0) return true
    const haystack = normalize([m.concept, m.subconcept, m.notes].filter(Boolean).join(" "))
    return terms.every((t) => haystack.includes(t))
  })

  const filtered = Boolean(q || tipo || conceptFilter || subFilter)
  const income = movements.filter((m) => m.type === "ingreso").reduce((s, m) => s + m.amount, 0)
  const spent = movements.filter((m) => m.type === "gasto").reduce((s, m) => s + m.amount, 0)
  const conceptList = (concepts.data ?? []) as FinanceConcept[]
  const pendingSub = all.filter((m) => m.source === "manual" && !m.subconcept).length

  const breakdown = Object.values(
    movements.reduce<Record<string, { type: Movement["type"]; concept: string; sub: string; count: number; total: number }>>(
      (acc, m) => {
        const sub = m.subconcept || "Sin subconcepto"
        const key = `${m.type}|${m.concept}|${sub}`
        acc[key] ??= { type: m.type, concept: m.concept, sub, count: 0, total: 0 }
        acc[key].count += 1
        acc[key].total += m.amount
        return acc
      },
      {},
    ),
  ).sort((a, b) => b.total - a.total)

  const conceptOptions = [...new Set(all.map((m) => m.concept))].sort((a, b) => a.localeCompare(b))
  const subOptions = [...new Set(all.map((m) => m.subconcept).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b))
  const periodLabel = allTime ? "de todo el historial" : "del mes"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finanzas"
        description="Cada gasto o ingreso lleva concepto y subconcepto para poder sumar por persona y por motivo."
      />

      <Card className="flex flex-col gap-4">
        <form method="get" role="search" className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="q" className="sr-only">
              Buscar movimientos
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Buscar: Rodrigo Aguilera + honorarios"
              className={`${fieldClass} pl-9`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="flex flex-col gap-1">
              <label htmlFor="mes" className="text-xs text-muted-foreground">
                Mes
              </label>
              <input id="mes" name="mes" type="month" defaultValue={allTime ? "" : month} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="tipo" className="text-xs text-muted-foreground">
                Tipo
              </label>
              <select id="tipo" name="tipo" defaultValue={tipo} className={fieldClass}>
                <option value="">Todos</option>
                <option value="gasto">Gastos</option>
                <option value="ingreso">Ingresos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="concepto" className="text-xs text-muted-foreground">
                Concepto
              </label>
              <select id="concepto" name="concepto" defaultValue={conceptFilter} className={fieldClass}>
                <option value="">Todos</option>
                {conceptOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sub" className="text-xs text-muted-foreground">
                Subconcepto
              </label>
              <select id="sub" name="sub" defaultValue={subFilter} className={fieldClass}>
                <option value="">Todos</option>
                {subOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={SIN_SUB}>Sin subconcepto</option>
              </select>
            </div>
            <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
              <button type="submit" className={`${secondaryButtonClass} min-h-11 flex-1`}>
                Filtrar
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link
              href={`?mes=todo${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="text-electric underline-offset-4 hover:underline"
            >
              Ver todo el historial
            </Link>
            {(filtered || allTime) && (
              <Link href="?" className="text-muted-foreground underline-offset-4 hover:underline">
                Limpiar filtros
              </Link>
            )}
            {pendingSub > 0 && (
              <Link
                href={`?mes=${allTime ? "todo" : month}&sub=${SIN_SUB}`}
                className="text-amber-300 underline-offset-4 hover:underline"
              >
                {pendingSub} sin subconcepto para revisar
              </Link>
            )}
          </div>
        </form>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label={`Ingresos ${periodLabel}${filtered ? " (filtrado)" : ""}`} value={money(income)} />
          <Stat label={`Gastos ${periodLabel}${filtered ? " (filtrado)" : ""}`} value={money(spent)} />
          <Stat label="Resultado" value={money(income - spent)} />
        </dl>

        {breakdown.length > 0 && (
          <details className="group rounded-xl border border-border" open={filtered}>
            <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
              Detalle por concepto y subconcepto ({breakdown.length})
            </summary>
            <div className="overflow-x-auto px-4 pb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 font-medium">Concepto</th>
                    <th className="py-2 font-medium">Subconcepto</th>
                    <th className="py-2 text-right font-medium">Cant.</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {breakdown.map((b) => (
                    <tr key={`${b.type}|${b.concept}|${b.sub}`}>
                      <td className="py-2">{b.concept}</td>
                      <td className="py-2 text-muted-foreground">{b.sub}</td>
                      <td className="py-2 text-right tabular-nums">{b.count}</td>
                      <td className={`py-2 text-right font-semibold tabular-nums ${b.type === "gasto" ? "text-red-200" : "text-emerald-300"}`}>
                        {b.type === "gasto" ? "−" : "+"}
                        {money(b.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <SectionTitle>Cargar movimiento</SectionTitle>
            <FinanceForm concepts={conceptList} today={today} />
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle>Predeterminados</SectionTitle>
            {(
              [
                ["gasto", "Conceptos de gasto"],
                ["ingreso", "Conceptos de ingreso"],
                ["subconcepto", "Subconceptos (gastos e ingresos)"],
              ] as const
            ).map(([k, title]) => (
              <div key={k} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
                <ul className="flex flex-wrap gap-2">
                  {conceptList
                    .filter((c) => c.kind === k)
                    .map((c) => (
                      <li key={c.id} className="flex items-center gap-1 rounded-full border border-border bg-surface py-1 pl-3 pr-1 text-sm">
                        {c.name}
                        <ActionForm
                          action={deleteFinanceConcept}
                          inline
                          confirmText={`¿Quitar "${c.name}" de los predeterminados?`}
                          submitLabel={
                            <>
                              <X className="size-3.5" aria-hidden="true" />
                              <span className="sr-only">Quitar {c.name}</span>
                            </>
                          }
                          submitClassName="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/20 hover:text-red-200"
                        >
                          <input type="hidden" name="id" value={c.id} />
                        </ActionForm>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            <ActionForm action={saveFinanceConcept} inline submitLabel="Agregar" submitClassName={`${secondaryButtonClass} min-h-11`} resetOnSuccess>
              <label htmlFor="c-kind" className="sr-only">
                Tipo
              </label>
              <select id="c-kind" name="kind" defaultValue="gasto" className={`${fieldClass} w-auto`}>
                <option value="gasto">Concepto de gasto</option>
                <option value="ingreso">Concepto de ingreso</option>
                <option value="subconcepto">Subconcepto</option>
              </select>
              <label htmlFor="c-name" className="sr-only">
                Nombre
              </label>
              <input id="c-name" name="name" required placeholder="Nuevo nombre" className={`${fieldClass} min-w-0 flex-1`} />
            </ActionForm>
          </Card>
        </div>

        <Card className="flex flex-col gap-4">
          <SectionTitle>
            Movimientos {periodLabel} ({movements.length}
            {filtered ? ` de ${all.length}` : ""})
          </SectionTitle>
          {movements.length === 0 ? (
            <EmptyState>{filtered ? "No hay movimientos con esos filtros." : "No hay movimientos en este período."}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {movements.map((m) => (
                <li key={m.key} className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {m.concept}
                        {m.subconcept ? (
                          <span className="text-muted-foreground"> · {m.subconcept}</span>
                        ) : (
                          <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">sin subconcepto</span>
                        )}
                      </span>
                      {m.notes && <span className="truncate text-xs text-muted-foreground">{m.notes}</span>}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(m.date)}
                        {m.method ? ` · ${PAYMENT_METHOD[m.method] ?? m.method}` : ""}
                        {m.source === "turno" ? " · automático" : ""}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${m.type === "gasto" ? "text-red-200" : "text-emerald-300"}`}>
                      {m.type === "gasto" ? "−" : "+"}
                      {money(m.amount)}
                    </span>
                    {m.source === "manual" && (
                      <ActionForm
                        action={deleteFinanceEntry}
                        inline
                        confirmText="¿Borrar este movimiento?"
                        submitLabel={
                          <>
                            <X className="size-4" aria-hidden="true" />
                            <span className="sr-only">Borrar</span>
                          </>
                        }
                        submitClassName="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-red-500/20 hover:text-red-200"
                      >
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="kind" value={m.type} />
                      </ActionForm>
                    )}
                  </div>
                  {m.source === "manual" && (
                    <details className="mt-2">
                      <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 text-xs text-electric">
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Editar concepto
                      </summary>
                      <div className="mt-3 rounded-xl border border-border p-3">
                        <FinanceEditForm entry={m} concepts={conceptList} today={today} />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
