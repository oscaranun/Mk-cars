import { updatePaymentRecord } from "@/app/admin/(panel)/edit-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, EmptyState, Field, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { argentinaParts, formatDateTime, money } from "@/lib/admin/format"
import { PAYMENT_METHOD } from "@/lib/admin/labels"

export type ClientPayment = {
  id: string
  amount: number
  method: string
  paid_at: string
  created_at: string
  appointment_id: string | null
  voided_at: string | null
  kind: string
  notes: string | null
  concept: string | null
}

export function ClientPayments({
  payments,
  appointments = [],
}: {
  payments: ClientPayment[]
  appointments?: { id: string; service: string; start: string | null }[]
}) {
  if (!payments.length) return <EmptyState>Sin ingresos registrados para este cliente.</EmptyState>
  return (
    <ul className="space-y-3">
      {payments.map((payment) => {
        const date = argentinaParts(payment.paid_at)
        const prefix = `client-payment-${payment.id}`
        return (
          <li key={payment.id} className="rounded-2xl border border-border p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className={payment.voided_at ? "line-through text-muted-foreground" : "font-semibold"}>
                {money(payment.amount)} · {PAYMENT_METHOD[payment.method] ?? payment.method}
              </span>
              <Badge tone={payment.voided_at ? "danger" : "success"}>
                {payment.voided_at
                  ? "Anulado / rectificado"
                  : payment.kind === "propina"
                    ? "Adicional"
                    : "Ingreso vigente"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cobro: {formatDateTime(payment.paid_at)} · Cargado: {formatDateTime(payment.created_at)}
            </p>
            {payment.concept && <p className="mt-2 font-medium">{payment.concept}</p>}
            {payment.notes && <p className="mt-2">{payment.notes}</p>}
            {!payment.voided_at && (
              <details className="mt-3">
                <summary className="cursor-pointer text-electric">Corregir este ingreso sin salir de la ficha</summary>
                <ActionForm
                  action={updatePaymentRecord}
                  submitLabel="Guardar corrección"
                  submitClassName={secondaryButtonClass}
                  className="mt-3"
                >
                  <input type="hidden" name="payment_id" value={payment.id} />
                  {payment.appointment_id ? (
                    <input type="hidden" name="appointment_id" value={payment.appointment_id} />
                  ) : (
                    <Field label="Aplicar a un turno (opcional)" htmlFor={`${prefix}-appointment`}>
                      <select id={`${prefix}-appointment`} name="appointment_id" defaultValue="" className={fieldClass}>
                        <option value="">Mantener a cuenta</option>
                        {appointments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.service} · {a.start ? formatDateTime(a.start) : "Sin fecha"}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Importe" htmlFor={`${prefix}-amount`}>
                      <input
                        id={`${prefix}-amount`}
                        name="amount"
                        required
                        inputMode="decimal"
                        defaultValue={payment.amount}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Fecha y hora real del cobro" htmlFor={`${prefix}-date`}>
                      <input
                        id={`${prefix}-date`}
                        name="paid_at"
                        type="datetime-local"
                        required
                        defaultValue={`${date.date}T${date.time}`}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Medio" htmlFor={`${prefix}-method`}>
                      <select
                        id={`${prefix}-method`}
                        name="method"
                        defaultValue={payment.method}
                        className={fieldClass}
                      >
                        {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Concepto" htmlFor={`${prefix}-concept`}>
                      <input
                        id={`${prefix}-concept`}
                        name="concept"
                        defaultValue={payment.concept ?? ""}
                        maxLength={200}
                        className={fieldClass}
                      />
                    </Field>
                  </div>
                  <Field label="Observaciones" htmlFor={`${prefix}-notes`}>
                    <textarea
                      id={`${prefix}-notes`}
                      name="notes"
                      defaultValue={payment.notes ?? ""}
                      maxLength={500}
                      className={fieldClass}
                    />
                  </Field>
                  {payment.kind === "servicio" && payment.appointment_id && (
                    <label className="flex items-start gap-2">
                      <input type="checkbox" name="price_mode" value="precio" className="mt-1" />
                      El precio estaba mal: ajustar también el precio final a lo cobrado. Si solo cambió el pago, dejá
                      esta opción desmarcada.
                    </label>
                  )}
                  <Field label="Motivo de la corrección" htmlFor={`${prefix}-reason`}>
                    <input
                      id={`${prefix}-reason`}
                      name="reason"
                      required
                      minLength={3}
                      maxLength={300}
                      className={fieldClass}
                    />
                  </Field>
                </ActionForm>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
