import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { addAppointmentNote, recordTransferPayment, voidTransferPayment } from "@/app/admin/(panel)/offer-actions"
import { ActionForm } from "@/components/admin/action-form"
import { isMissingTable } from "@/components/admin/offer-panel"
import { Badge, Card, Field, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatDateTime, money, todayArgentina } from "@/lib/admin/format"

const inputClass = `${fieldClass} text-base md:text-sm`

type Note = { id: string; body: string; author_email: string | null; created_at: string }

export async function AppointmentNotes({ supabase, appointmentId }: { supabase: SupabaseClient; appointmentId: string }) {
  const { data, error } = await supabase
    .from("appointment_notes")
    .select("id, body, author_email, created_at")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .returns<Note[]>()
  if (isMissingTable(error?.code)) return null

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle>Notas internas</SectionTitle>
      <p className="text-xs text-muted-foreground">Solo las ve el equipo. No se editan ni se borran.</p>
      <ActionForm action={addAppointmentNote} submitLabel="Agregar nota" submitClassName={secondaryButtonClass} resetOnSuccess>
        <input type="hidden" name="appointment_id" value={appointmentId} />
        <Field label="Nueva nota" htmlFor="note-body">
          <textarea id="note-body" name="body" rows={3} required maxLength={4000} className={`${inputClass} py-2.5`} />
        </Field>
      </ActionForm>
      {data && data.length > 0 && (
        <ol className="flex flex-col gap-3 border-t border-border pt-4">
          {data.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 text-sm">
              <span className="text-xs tabular-nums text-muted-foreground">
                {`${formatDateTime(n.created_at)}${n.author_email ? ` · ${n.author_email}` : ""}`}
              </span>
              <p className="whitespace-pre-wrap text-pretty">{n.body}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

type Payment = {
  id: string
  amount: number
  method: string
  paid_at: string
  reference: string | null
  notes: string | null
  verified_by_email: string | null
  voided_at: string | null
  void_reason: string | null
  voided_by_email: string | null
}

const PAYMENT_TONE = { pendiente: "warning", parcial: "info", pagado: "success" } as const
const PAYMENT_LABEL = { pendiente: "Pago pendiente", parcial: "Pago parcial", pagado: "Pagado" } as const

export async function AppointmentPayments({
  supabase,
  appointment,
}: {
  supabase: SupabaseClient
  appointment: { id: string; status: string; total: number | null; amount_paid: number | null; payment_status: string | null }
}) {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, method, paid_at, reference, notes, verified_by_email, voided_at, void_reason, voided_by_email")
    .eq("appointment_id", appointment.id)
    .order("paid_at", { ascending: false })
    .returns<Payment[]>()
  if (isMissingTable(error?.code)) return null

  const canCharge = appointment.status === "confirmado" || appointment.status === "realizado"
  const paid = Number(appointment.amount_paid ?? 0)
  const total = appointment.total
  const balance = total != null ? Math.max(0, total - paid) : null
  const status = (appointment.payment_status ?? "pendiente") as keyof typeof PAYMENT_LABEL

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle aside={<Badge tone={PAYMENT_TONE[status] ?? "neutral"}>{PAYMENT_LABEL[status] ?? status}</Badge>}>Pagos</SectionTitle>
      <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-surface p-4 text-sm tabular-nums">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="font-medium">{total != null ? money(total) : "A definir"}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Pagado</dt>
          <dd className="font-medium">{money(paid)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Saldo</dt>
          <dd className="font-medium">{balance != null ? money(balance) : "—"}</dd>
        </div>
      </dl>

      {!canCharge && (
        <p className="text-sm text-muted-foreground text-pretty">
          Los pagos se registran cuando el turno está confirmado. No pidas transferencias antes de que el cliente acepte.
        </p>
      )}

      {canCharge && balance !== 0 && total != null && (
        <ActionForm action={recordTransferPayment} submitLabel="Registrar transferencia" resetOnSuccess>
          <input type="hidden" name="appointment_id" value={appointment.id} />
          <input type="hidden" name="request_id" value={randomUUID()} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importe recibido" htmlFor="pay-amount">
              <input id="pay-amount" name="amount" inputMode="decimal" required defaultValue={balance ?? ""} className={inputClass} />
            </Field>
            <Field label="Fecha" htmlFor="pay-date">
              <input id="pay-date" name="date" type="date" required max={todayArgentina()} defaultValue={todayArgentina()} className={inputClass} />
            </Field>
            <Field label="N.º de operación (opcional)" htmlFor="pay-ref" className="col-span-2">
              <input id="pay-ref" name="reference" maxLength={80} placeholder="Evita cargar dos veces la misma transferencia" className={inputClass} />
            </Field>
            <Field label="Nota (opcional)" htmlFor="pay-notes" className="col-span-2">
              <input id="pay-notes" name="notes" maxLength={300} className={inputClass} />
            </Field>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-surface p-3 text-sm">
            <input type="checkbox" name="verified" required className="mt-0.5 size-5 accent-primary" />
            <span className="text-pretty">Verifiqué que la transferencia está acreditada en la cuenta de MK Cars.</span>
          </label>
        </ActionForm>
      )}

      {data && data.length > 0 && (
        <ol className="flex flex-col gap-3 border-t border-border pt-4">
          {data.map((p) => (
            <li key={p.id} className="flex flex-col gap-1.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                <span className={p.voided_at ? "text-muted-foreground line-through" : "font-medium"}>{money(p.amount)}</span>
                {p.voided_at ? <Badge tone="danger">Anulado</Badge> : <Badge tone="success">Verificado</Badge>}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {[formatDateTime(p.paid_at), p.method, p.reference && `Op. ${p.reference}`, p.verified_by_email && `por ${p.verified_by_email}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {p.notes && <span className="text-xs text-pretty">{p.notes}</span>}
              {p.voided_at ? (
                <span className="text-xs text-muted-foreground text-pretty">
                  {`Anulado ${formatDateTime(p.voided_at)}${p.voided_by_email ? ` por ${p.voided_by_email}` : ""}: ${p.void_reason ?? ""}`}
                </span>
              ) : (
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-xs text-muted-foreground">Anular pago</summary>
                  <ActionForm
                    action={voidTransferPayment}
                    submitLabel="Anular"
                    submitClassName={secondaryButtonClass}
                    confirmText="¿Anular este pago? Queda en el historial y deja de sumar como ingreso."
                    inline
                  >
                    <input type="hidden" name="appointment_id" value={appointment.id} />
                    <input type="hidden" name="payment_id" value={p.id} />
                    <Field label="Motivo" htmlFor={`void-${p.id}`} className="flex-1">
                      <input id={`void-${p.id}`} name="reason" required minLength={3} maxLength={300} className={inputClass} />
                    </Field>
                  </ActionForm>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
