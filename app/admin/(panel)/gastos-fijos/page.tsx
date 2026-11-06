import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin/auth"
import { addRecurringExpense, generateRecurringExpenses, updateRecurringExpense } from "@/app/admin/(panel)/pro-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, EmptyState, Field, PageHeader, SectionTitle, Stat, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { money, todayArgentina } from "@/lib/admin/format"
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Gastos fijos" }

type Row = {
  id: string
  description: string
  category: string
  method: string
  amount: number
  day_of_month: number
  active: boolean
  last_generated_month: string | null
}

export default async function GastosFijosPage() {
  const { supabase } = await requireAdmin()
  const month = todayArgentina().slice(0, 7)
  const { data } = await supabase.from("recurring_expenses").select("*").order("day_of_month")
  const rows = (data ?? []) as Row[]
  const active = rows.filter((r) => r.active)
  const monthly = active.reduce((s, r) => s + Number(r.amount), 0)
  const pending = active.filter((r) => r.last_generated_month !== month).length

  return (
    <>
      <PageHeader
        title="Gastos fijos"
        description="Gastos que se repiten todos los meses. Con un clic se cargan en Egresos y entran en la ganancia del mes."
        actions={
          <ActionForm action={generateRecurringExpenses} submitLabel={`Cargar gastos de este mes${pending ? ` (${pending})` : ""}`} />
        }
      />
      <dl className="grid gap-3 sm:grid-cols-2">
        <Stat label="Total mensual" value={money(monthly)} hint={`${active.length} gastos activos`} />
        <Stat label="Pendientes de cargar este mes" value={pending} />
      </dl>
      <Card>
        <ActionForm action={addRecurringExpense} submitLabel="Agregar" inline resetOnSuccess>
          <Field label="Descripción" htmlFor="description" className="min-w-48 flex-1">
            <input id="description" name="description" required maxLength={120} placeholder="Combustible camioneta" className={fieldClass} />
          </Field>
          <Field label="Categoría" htmlFor="category">
            <select id="category" name="category" className={fieldClass}>
              {Object.entries(EXPENSE_CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Medio" htmlFor="method">
            <select id="method" name="method" className={fieldClass}>
              {Object.entries(PAYMENT_METHOD).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Importe" htmlFor="amount">
            <input id="amount" name="amount" inputMode="decimal" required className={`${fieldClass} w-32`} />
          </Field>
          <Field label="Día del mes" htmlFor="day_of_month">
            <input id="day_of_month" name="day_of_month" type="number" min={1} max={28} defaultValue={1} className={`${fieldClass} w-24`} />
          </Field>
        </ActionForm>
      </Card>
      <section className="flex flex-col gap-3">
        <SectionTitle>Lista</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState>Todavía no cargaste gastos fijos.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="font-medium">{r.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Día {r.day_of_month} · {EXPENSE_CATEGORY[r.category] ?? r.category} · {PAYMENT_METHOD[r.method] ?? r.method}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{money(r.amount)}</span>
                {!r.active ? (
                  <Badge>Pausado</Badge>
                ) : r.last_generated_month === month ? (
                  <Badge tone="success">Cargado este mes</Badge>
                ) : (
                  <Badge tone="warning">Pendiente</Badge>
                )}
                <ActionForm action={updateRecurringExpense} submitLabel={r.active ? "Pausar" : "Activar"} submitClassName={secondaryButtonClass}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="op" value={r.active ? "pausar" : "activar"} />
                </ActionForm>
                <ActionForm action={updateRecurringExpense} submitLabel="Borrar" submitClassName={secondaryButtonClass} confirmText="¿Borrar este gasto fijo? Los egresos ya cargados no se borran.">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="op" value="borrar" />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
