import Link from "next/link"
import { ArrowLeft, X } from "lucide-react"
import { deleteFinanceConcept, deleteFinanceEntry, saveFinanceConcept } from "@/app/admin/(panel)/pruebas/actions"
import { ActionForm } from "@/components/admin/action-form"
import { FinanceForm } from "@/components/admin/ficha/finance-form"
import { Card, EmptyState, PageHeader, SectionTitle, Stat, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDate, isValidDate, money, startOfArgentinaDay, todayArgentina } from "@/lib/admin/format"
import { PAYMENT_METHOD } from "@/lib/admin/labels"

export const metadata = { title: "Finanzas (prueba) | MK Cars" }

type Movement = {
  key: string
  id: string
  type: "ingreso" | "gasto"
  source: "turno" | "manual"
  date: string
  concept: string
  amount: number
  method: string | null
  deletable: boolean
}

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
  return { from: `${month}-01`, to: `${next}-01` }
}

export default async function PruebaFinanzasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase } = await requireAdmin()
  const { mes } = await searchParams
  const today = todayArgentina()
  const month = mes && isValidDate(`${mes}-01`) ? mes : today.slice(0, 7)
  const { from, to } = monthBounds(month)

  const [concepts, payments, others, expenses] = await Promise.all([
    supabase.from("finance_concepts").select("id, kind, name").order("name"),
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, kind, appointment:appointments(service, contact_name, client:clients(full_name))")
      .is("voided_at", null)
      .gte("paid_at", startOfArgentinaDay(from))
      .lt("paid_at", startOfArgentinaDay(to)),
    supabase.from("other_incomes").select("id, received_on, concept, amount, method, is_demo").gte("received_on", from).lt("received_on", to),
    supabase
      .from("expenses")
      .select("id, spent_on, category, description, amount, method, is_demo")
      .is("voided_at", null)
      .gte("spent_on", from)
      .lt("spent_on", to),
  ])

  type PaymentRow = {
    id: string
    amount: number
    method: string
    paid_at: string
    kind: string | null
    appointment: { service: string; contact_name: string | null; client: { full_name: string } | null } | null
  }

  const movements: Movement[] = [
    ...((payments.data ?? []) as unknown as PaymentRow[]).map((p) => ({
      key: `p-${p.id}`,
      id: p.id,
      type: "ingreso" as const,
      source: "turno" as const,
      date: p.paid_at,
      concept: `${p.kind === "servicio" ? "Turno" : "Adicional"} · ${p.appointment?.contact_name || p.appointment?.client?.full_name || "Cliente"}`,
      amount: Number(p.amount),
      method: p.method,
      deletable: false,
    })),
    ...(others.data ?? []).map((o) => ({
      key: `o-${o.id}`,
      id: o.id,
      type: "ingreso" as const,
      source: "manual" as const,
      date: `${o.received_on}T12:00:00-03:00`,
      concept: o.concept,
      amount: Number(o.amount),
      method: o.method,
      deletable: o.is_demo,
    })),
    ...(expenses.data ?? []).map((e) => ({
      key: `e-${e.id}`,
      id: e.id,
      type: "gasto" as const,
      source: "manual" as const,
      date: `${e.spent_on}T12:00:00-03:00`,
      concept: e.description || e.category,
      amount: Number(e.amount),
      method: e.method,
      deletable: e.is_demo,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const income = movements.filter((m) => m.type === "ingreso").reduce((s, m) => s + m.amount, 0)
  const spent = movements.filter((m) => m.type === "gasto").reduce((s, m) => s + m.amount, 0)
  const conceptList = (concepts.data ?? []) as { id: string; kind: "ingreso" | "gasto"; name: string }[]

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/pruebas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Panel de pruebas
      </Link>
      <PageHeader
        title="Finanzas — una sola pantalla"
        description="Cargá cualquier gasto o ingreso desde acá. Los cobros de turnos aparecen solos."
        actions={
          <form method="get" className="flex items-end gap-2">
            <label htmlFor="mes" className="sr-only">
              Mes
            </label>
            <input id="mes" name="mes" type="month" defaultValue={month} className={`${fieldClass} w-auto`} />
            <button type="submit" className={secondaryButtonClass}>
              Ver
            </button>
          </form>
        }
      />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Ingresos del mes" value={money(income)} />
        <Stat label="Gastos del mes" value={money(spent)} />
        <Stat label="Resultado" value={money(income - spent)} />
      </dl>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <SectionTitle>Cargar movimiento</SectionTitle>
            <FinanceForm concepts={conceptList} today={today} />
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle>Conceptos predeterminados</SectionTitle>
            {(["gasto", "ingreso"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k === "gasto" ? "Gastos" : "Ingresos"}</h3>
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
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </select>
              <label htmlFor="c-name" className="sr-only">
                Nombre del concepto
              </label>
              <input id="c-name" name="name" required placeholder="Nuevo concepto" className={`${fieldClass} min-w-0 flex-1`} />
            </ActionForm>
          </Card>
        </div>

        <Card className="flex flex-col gap-4">
          <SectionTitle>Movimientos del mes ({movements.length})</SectionTitle>
          {movements.length === 0 ? (
            <EmptyState>No hay movimientos este mes.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {movements.map((m) => (
                <li key={m.key} className="flex items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{m.concept}</span>
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
                  {m.deletable && (
                    <ActionForm
                      action={deleteFinanceEntry}
                      inline
                      confirmText="¿Borrar este movimiento de prueba?"
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
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
