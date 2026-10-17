import { Trash2 } from "lucide-react"
import { addExpense, deleteExpense } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Card, EmptyState, Field, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { money } from "@/lib/admin/format"
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export type CashPayment = { id: string; amount: number; method: string; paid_at: string; client: string; service: string }
export type CashExpense = { id: string; amount: number; method: string; category: string; description: string | null }

export function MethodBreakdown({ income, expenses }: { income: CashPayment[]; expenses: CashExpense[] }) {
  const rows = Object.entries(PAYMENT_METHOD)
    .map(([method, label]) => {
      const inSum = income.filter((p) => p.method === method).reduce((s, p) => s + Number(p.amount), 0)
      const outSum = expenses.filter((e) => e.method === method).reduce((s, e) => s + Number(e.amount), 0)
      return { method, label, inSum, outSum, net: inSum - outSum }
    })
    .filter((r) => r.inSum || r.outSum || r.method === "efectivo")

  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>Por medio de pago</SectionTitle>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((r) => (
          <li key={r.method} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{r.label}</span>
              <span className={cn("text-base font-semibold tabular-nums", r.net < 0 && "text-red-400")}>{money(r.net)}</span>
            </div>
            <div className="flex justify-between gap-3 text-xs tabular-nums text-muted-foreground">
              <span>Entró {money(r.inSum)}</span>
              <span>Salió {money(r.outSum)}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground text-pretty">
        El neto en efectivo es lo que debería haber en la caja física al cerrar el día.
      </p>
    </Card>
  )
}

export function DayPayments({ payments }: { payments: CashPayment[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Cobros del día</SectionTitle>
      {payments.length ? (
        <ul className="flex flex-col gap-2">
          {payments.map((p) => (
            <li key={p.id}>
              <Card className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{p.client}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {p.service} · {PAYMENT_METHOD[p.method] ?? p.method}
                  </span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{money(p.amount)}</span>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No se registraron cobros este día.</EmptyState>
      )}
    </section>
  )
}

export function DayExpenses({ expenses, day, today }: { expenses: CashExpense[]; day: string; today: string }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Gastos del día</SectionTitle>
      {expenses.length > 0 && (
        <ul className="flex flex-col gap-2">
          {expenses.map((e) => (
            <li key={e.id}>
              <Card className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{EXPENSE_CATEGORY[e.category] ?? e.category}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {e.description ? `${e.description} · ` : ""}
                    {PAYMENT_METHOD[e.method] ?? e.method}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold tabular-nums">−{money(e.amount)}</span>
                  <ActionForm
                    action={deleteExpense}
                    submitLabel={<Trash2 className="size-4" aria-label="Eliminar gasto" />}
                    submitClassName={cn(secondaryButtonClass, "size-11 px-0")}
                  >
                    <input type="hidden" name="id" value={e.id} />
                  </ActionForm>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">Registrar gasto</h3>
        <ActionForm action={addExpense} submitLabel="Agregar gasto" resetOnSuccess className="flex flex-col gap-3">
          <input type="hidden" name="day" value={day > today ? today : day} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría" htmlFor="exp-category">
              <select id="exp-category" name="category" required defaultValue="productos" className={fieldClass}>
                {Object.entries(EXPENSE_CATEGORY).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Importe" htmlFor="exp-amount">
              <input id="exp-amount" name="amount" inputMode="decimal" required placeholder="0" className={fieldClass} />
            </Field>
          </div>
          <Field label="Medio" htmlFor="exp-method">
            <select id="exp-method" name="method" required defaultValue="efectivo" className={fieldClass}>
              {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Detalle (opcional)" htmlFor="exp-description">
            <input id="exp-description" name="description" maxLength={200} placeholder="Ej: shampoo, nafta" className={fieldClass} />
          </Field>
        </ActionForm>
      </Card>
    </section>
  )
}
