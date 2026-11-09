import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { updatePaymentRecord } from "@/app/admin/(panel)/edit-actions"
import { ActionForm } from "@/components/admin/action-form"
import { CorrectionHistory } from "@/components/admin/correction-history"
import { Badge, Card, Field, PageHeader, TextLink, fieldClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { activePayments } from "@/lib/admin/payments"
import { formatDate, money } from "@/lib/admin/format"
import { PAYMENT_METHOD } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Editar ingreso" }

type PaymentRow = {
  id: string
  amount: number
  method: string
  paid_at: string
  notes: string | null
  concept?: string | null
  kind?: string | null
  voided_at?: string | null
  appointment_id: string | null
}

type ApptOption = {
  id: string
  service: string | null
  confirmed_start: string | null
  requested_start: string | null
  clients: { full_name: string } | null
}

function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 16)
}

export default async function EditIncomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: payment } = await activePayments((modern) =>
    supabase
      .from("payments")
      .select(`id, amount, method, paid_at, notes, appointment_id${modern ? ", concept, kind, voided_at" : ""}`)
      .eq("id", id)
      .maybeSingle<PaymentRow>(),
  )
  if (!payment) notFound()

  const { data: appts } = await supabase
    .from("appointments")
    .select("id, service, confirmed_start, requested_start, clients(full_name)")
    .order("created_at", { ascending: false })
    .limit(150)
    .returns<ApptOption[]>()
  const options = appts ?? []

  return (
    <>
      <PageHeader title="Editar ingreso" description={`${money(Number(payment.amount))} · ${formatDate(payment.paid_at)}`} />
      <p className="text-sm">
        <TextLink href="/admin/movimientos">Volver a movimientos</TextLink>
      </p>

      {payment.voided_at ? (
        <Card>
          <Badge tone="danger">Anulado</Badge>
          <p className="mt-2 text-sm text-muted-foreground">Este ingreso fue anulado y no puede editarse. Queda en el historial.</p>
        </Card>
      ) : (
        <Card>
          <ActionForm action={updatePaymentRecord} submitLabel="Guardar corrección">
            <input type="hidden" name="payment_id" value={payment.id} />
            {payment.kind === "propina" && <Badge tone="info">Adicional / propina</Badge>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha y hora" htmlFor="paid_at">
                <input id="paid_at" name="paid_at" type="datetime-local" required defaultValue={toLocalInput(payment.paid_at)} className={`${fieldClass} min-w-0 max-w-full appearance-none`} />
              </Field>
              <Field label="Importe" htmlFor="amount">
                <input id="amount" name="amount" type="number" inputMode="decimal" min="1" step="0.01" required defaultValue={Number(payment.amount)} className={fieldClass} />
              </Field>
              <Field label="Medio de pago" htmlFor="method">
                <select id="method" name="method" defaultValue={payment.method} className={fieldClass}>
                  {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Concepto" htmlFor="concept">
                <input id="concept" name="concept" maxLength={200} defaultValue={payment.concept ?? ""} className={fieldClass} />
              </Field>
              <Field label="Servicio vinculado" htmlFor="appointment_id" className="sm:col-span-2">
                <select id="appointment_id" name="appointment_id" defaultValue={payment.appointment_id ?? ""} className={fieldClass}>
                  <option value="">Sin vincular</option>
                  {options.map((a) => (
                    <option key={a.id} value={a.id}>
                      {[a.clients?.full_name ?? "Cliente", a.service, formatDate(a.confirmed_start ?? a.requested_start ?? "")].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
                <textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={payment.notes ?? ""} className={fieldClass} />
              </Field>
              <Field label="Motivo de la corrección (obligatorio)" htmlFor="reason" className="sm:col-span-2">
                <input id="reason" name="reason" required minLength={3} maxLength={300} placeholder="Ej: el cliente pagó por transferencia" className={fieldClass} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Si el día ya fue cerrado, se crea una rectificación y el original queda anulado en el historial.
            </p>
          </ActionForm>
        </Card>
      )}

      <CorrectionHistory entity="payment" entityId={payment.id} />
    </>
  )
}
