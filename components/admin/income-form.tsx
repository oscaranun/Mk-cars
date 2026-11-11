import { randomUUID } from "node:crypto"
import { recordIncome } from "@/app/admin/(panel)/edit-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass } from "@/components/admin/ui"
import { argentinaParts, formatDateTime } from "@/lib/admin/format"
import { PAYMENT_METHOD } from "@/lib/admin/labels"

export function IncomeForm({
  clientId,
  appointments = [],
  idPrefix = "income",
}: {
  clientId?: string
  appointments?: { id: string; service: string; start: string | null }[]
  idPrefix?: string
}) {
  const date = argentinaParts(new Date())
  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="cursor-pointer font-semibold text-electric">Registrar un ingreso</summary>
      <p className="mt-3 text-sm text-muted-foreground">
        Usá la fecha real de la transferencia o del efectivo. Si no lo vinculás a un turno, queda como ingreso a cuenta
        y no cancela automáticamente ningún saldo.
      </p>
      <ActionForm action={recordIncome} submitLabel="Guardar ingreso" resetOnSuccess className="mt-3">
        <input type="hidden" name="request_id" value={randomUUID()} />
        {clientId && <input type="hidden" name="client_id" value={clientId} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Importe recibido" htmlFor={`${idPrefix}-amount`}>
            <input id={`${idPrefix}-amount`} name="amount" required inputMode="decimal" className={fieldClass} />
          </Field>
          <Field label="Fecha y hora real del ingreso" htmlFor={`${idPrefix}-date`}>
            <input
              id={`${idPrefix}-date`}
              name="paid_at"
              type="datetime-local"
              required
              defaultValue={`${date.date}T${date.time}`}
              className={fieldClass}
            />
          </Field>
          <Field label="Medio" htmlFor={`${idPrefix}-method`}>
            <select id={`${idPrefix}-method`} name="method" defaultValue="transferencia" className={fieldClass}>
              {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Concepto" htmlFor={`${idPrefix}-concept`}>
            <input
              id={`${idPrefix}-concept`}
              name="concept"
              required
              minLength={2}
              maxLength={200}
              className={fieldClass}
            />
          </Field>
        </div>
        {appointments.length > 0 && (
          <Field label="Turno al que corresponde (opcional)" htmlFor={`${idPrefix}-appointment`}>
            <select id={`${idPrefix}-appointment`} name="appointment_id" defaultValue="" className={fieldClass}>
              <option value="">Ingreso a cuenta, sin aplicar a un turno</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.service} · {a.start ? formatDateTime(a.start) : "Sin fecha"}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Observaciones" htmlFor={`${idPrefix}-notes`}>
          <textarea id={`${idPrefix}-notes`} name="notes" rows={2} maxLength={500} className={fieldClass} />
        </Field>
      </ActionForm>
    </details>
  )
}
