import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { updateExpenseRecord, voidExpenseRecord } from "@/app/admin/(panel)/edit-actions"
import { ActionForm } from "@/components/admin/action-form"
import { CorrectionHistory } from "@/components/admin/correction-history"
import { Badge, Card, Field, PageHeader, SectionTitle, TextLink, dangerButtonClass, fieldClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { activePayments } from "@/lib/admin/payments"
import { formatDate, money, todayArgentina } from "@/lib/admin/format"
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Editar gasto" }

type ExpenseRow = {
  id: string
  amount: number
  method: string
  category: string
  description: string | null
  spent_on: string
  supplier?: string | null
  notes?: string | null
  appointment_id?: string | null
  voided_at?: string | null
}

type ApptOption = {
  id: string
  service: string | null
  confirmed_start: string | null
  requested_start: string | null
  clients: { full_name: string } | null
}

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: expense } = await activePayments((modern) =>
    supabase
      .from("expenses")
      .select(`id, amount, method, category, description, spent_on${modern ? ", supplier, notes, appointment_id, voided_at" : ""}`)
      .eq("id", id)
      .maybeSingle<ExpenseRow>(),
  )
  if (!expense) notFound()

  const { data: appts } = await supabase
    .from("appointments")
    .select("id, service, confirmed_start, requested_start, clients(full_name)")
    .order("created_at", { ascending: false })
    .limit(150)
    .returns<ApptOption[]>()

  return (
    <>
      <PageHeader title="Editar gasto" description={`${money(Number(expense.amount))} · ${formatDate(`${expense.spent_on}T12:00:00-03:00`)}`} />
      <p className="text-sm">
        <TextLink href="/admin/movimientos">Volver a movimientos</TextLink>
      </p>

      {expense.voided_at ? (
        <Card>
          <Badge tone="danger">Anulado</Badge>
          <p className="mt-2 text-sm text-muted-foreground">Este gasto fue anulado. Queda en el historial y no suma en la caja.</p>
        </Card>
      ) : (
        <>
          <Card>
            <ActionForm action={updateExpenseRecord} submitLabel="Guardar corrección">
              <input type="hidden" name="expense_id" value={expense.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fecha" htmlFor="date">
                  <input id="date" name="date" type="date" required max={todayArgentina()} defaultValue={expense.spent_on} className={fieldClass} />
                </Field>
                <Field label="Importe" htmlFor="amount">
                  <input id="amount" name="amount" type="number" inputMode="decimal" min="1" step="0.01" required defaultValue={Number(expense.amount)} className={fieldClass} />
                </Field>
                <Field label="Categoría" htmlFor="category">
                  <select id="category" name="category" defaultValue={expense.category} className={fieldClass}>
                    {Object.entries(EXPENSE_CATEGORY).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Medio de pago" htmlFor="method">
                  <select id="method" name="method" defaultValue={expense.method} className={fieldClass}>
                    {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Descripción" htmlFor="description">
                  <input id="description" name="description" maxLength={200} defaultValue={expense.description ?? ""} className={fieldClass} />
                </Field>
                <Field label="Proveedor" htmlFor="supplier">
                  <input id="supplier" name="supplier" maxLength={120} defaultValue={expense.supplier ?? ""} className={fieldClass} />
                </Field>
                <Field label="Servicio vinculado" htmlFor="appointment_id" className="sm:col-span-2">
                  <select id="appointment_id" name="appointment_id" defaultValue={expense.appointment_id ?? ""} className={fieldClass}>
                    <option value="">Sin vincular</option>
                    {(appts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {[a.clients?.full_name ?? "Cliente", a.service, formatDate(a.confirmed_start ?? a.requested_start ?? "")].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
                  <textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={expense.notes ?? ""} className={fieldClass} />
                </Field>
                <Field label="Motivo de la corrección (obligatorio)" htmlFor="reason" className="sm:col-span-2">
                  <input id="reason" name="reason" required minLength={3} maxLength={300} placeholder="Ej: el importe real del ticket era otro" className={fieldClass} />
                </Field>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <SectionTitle>Anular gasto</SectionTitle>
            <ActionForm action={voidExpenseRecord} submitLabel="Anular gasto" submitClassName={dangerButtonClass} confirmText="¿Anular este gasto? Queda registrado en el historial.">
              <input type="hidden" name="id" value={expense.id} />
              <Field label="Motivo de la anulación" htmlFor="void_reason">
                <input id="void_reason" name="reason" required minLength={3} maxLength={300} className={fieldClass} />
              </Field>
            </ActionForm>
          </Card>
        </>
      )}

      <CorrectionHistory entity="expense" entityId={expense.id} />
    </>
  )
}
