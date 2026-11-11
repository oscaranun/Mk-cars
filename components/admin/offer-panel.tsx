import { headers } from "next/headers"
import type { SupabaseClient } from "@supabase/supabase-js"
import { reopenOffer } from "@/app/admin/(panel)/offer-actions"
import { acceptLinkedOffer } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { OfferEditor } from "@/components/admin/offer-editor"
import { OfferLinkShare } from "@/components/admin/offer-link-share"
import { Badge, Card, Field, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { argentinaParts, formatDateTime, money } from "@/lib/admin/format"
import { QueryErrorNotice } from "@/components/admin/query-error-notice"

export type Offer = {
  id: string
  token: string
  version: number
  status: string
  service_label: string
  total_price: number
  discount: number
  conditions: string | null
  slots: { start: string; duration: number }[]
  accepted_start: string | null
  accepted_at: string | null
  client_message: string | null
  responded_at: string | null
  updated_at: string
}

type OfferEvent = { id: number; version: number; kind: string; actor_label: string; created_at: string }

export const OFFER_STATUS: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "info" }> = {
  enviada: { label: "Esperando respuesta del cliente", tone: "warning" },
  aceptada: { label: "Aceptada por el cliente", tone: "success" },
  pide_alternativas: { label: "Pidió otros horarios", tone: "info" },
  mas_adelante: { label: "Prefiere coordinar más adelante", tone: "neutral" },
  anulada: { label: "Anulada", tone: "neutral" },
}

const EVENT_LABEL: Record<string, string> = {
  creada: "Propuesta creada",
  actualizada: "Propuesta modificada",
  aceptada: "El cliente aceptó",
  pide_alternativas: "El cliente pidió otros horarios",
  mas_adelante: "El cliente prefiere más adelante",
  reabierta: "Propuesta reabierta",
  anulada: "Anulada",
}

export function isMissingTable(code: string | undefined) {
  return code === "42P01" || code === "PGRST205" || code === "42703" || code === "PGRST200"
}

export async function loadOffer(supabase: SupabaseClient, appointmentId: string) {
  const [{ data: offer, error }, events] = await Promise.all([
    supabase
      .from("appointment_offers")
      .select(
        "id, token, version, status, service_label, total_price, discount, conditions, slots, accepted_start, accepted_at, client_message, responded_at, updated_at",
      )
      .eq("appointment_id", appointmentId)
      .maybeSingle<Offer>(),
    supabase
      .from("appointment_offer_events")
      .select("id, version, kind, actor_label, created_at, appointment_offers!inner(appointment_id)")
      .eq("appointment_offers.appointment_id", appointmentId)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<OfferEvent[]>(),
  ])
  return {
    offer,
    events: events.data ?? [],
    missing: isMissingTable(error?.code),
    failed: Boolean(error && !isMissingTable(error.code)),
  }
}

async function originUrl() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "mkcars.com.ar"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export async function OfferPanel({
  supabase,
  appointment,
  today,
  defaultPrice,
  loaded,
}: {
  supabase: SupabaseClient
  appointment: {
    id: string
    status: string
    service: string
    duration_minutes: number
    discount?: number | null
    clientName: string
    whatsapp: string | null
  }
  today: string
  defaultPrice: number | ""
  loaded?: Awaited<ReturnType<typeof loadOffer>>
}) {
  const { offer, events, missing, failed } = loaded ?? (await loadOffer(supabase, appointment.id))
  if (failed) return <QueryErrorNotice subject="las condiciones del turno" />
  if (missing) {
    return (
      <Card className="flex flex-col gap-2">
        <SectionTitle>Propuesta con enlace</SectionTitle>
        <p className="text-sm text-muted-foreground text-pretty">
          Requiere la migración 011. Mientras tanto podés seguir usando la propuesta por WhatsApp de abajo.
        </p>
      </Card>
    )
  }

  const editable = ["solicitado", "reprogramado", "esperando_cliente"].includes(appointment.status)
  const accepted = offer?.status === "aceptada"
  if (!offer && !editable) return null
  const link = offer ? `${await originUrl()}/propuesta/${offer.token}` : null
  const status = offer ? OFFER_STATUS[offer.status] : null
  const canAccept = appointment.status === "esperando_cliente" && offer && !accepted && offer.status !== "anulada"

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle aside={status && <Badge tone={status.tone}>{status.label}</Badge>}>
        {accepted ? "Acuerdo registrado" : offer ? "Opciones guardadas" : "Coordinar fecha y precio"}
      </SectionTitle>

      {!offer && (
        <p className="text-sm text-muted-foreground text-pretty">
          Cargá los horarios y el importe que estás coordinando. Después podés registrar acá la aceptación recibida por
          WhatsApp o compartir el enlace para que el cliente elija.
        </p>
      )}

      {offer && (
        <dl className="flex flex-col gap-2 rounded-2xl bg-surface p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Servicio</dt>
            <dd className="text-right">{offer.service_label}</dd>
          </div>
          <div className="flex justify-between gap-3 tabular-nums">
            <dt className="text-muted-foreground">Importe</dt>
            <dd className="text-right">
              {offer.discount > 0 ? `${money(offer.total_price)} − ${money(offer.discount)} = ` : ""}
              <span className="font-semibold">{money(offer.total_price - offer.discount)}</span>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">{accepted ? "Horario aceptado" : "Horarios ofrecidos"}</dt>
            <dd>
              <ul className="flex flex-col gap-0.5 tabular-nums">
                {(accepted
                  ? offer.slots.filter(
                      (s) =>
                        s.start === offer.accepted_start ||
                        new Date(s.start).getTime() === new Date(offer.accepted_start!).getTime(),
                    )
                  : offer.slots
                ).map((s) => (
                  <li key={s.start}>{`${formatDateTime(s.start)} · ${s.duration} min`}</li>
                ))}
              </ul>
            </dd>
          </div>
          {offer.client_message && (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              <dt className="text-muted-foreground">Mensaje del cliente</dt>
              <dd className="text-pretty">{offer.client_message}</dd>
            </div>
          )}
        </dl>
      )}

      {link && appointment.whatsapp && canAccept && (
        <details className="rounded-2xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Enviar opciones por enlace (opcional)</summary>
          <div className="pt-3">
            <OfferLinkShare
              link={link}
              phone={appointment.whatsapp}
              message={`Hola ${appointment.clientName.split(" ")[0] || ""}, te paso las opciones de turno de MK Cars. Elegí el horario que te quede mejor y aceptá desde este enlace: ${link}`}
            />
          </div>
        </details>
      )}

      {editable && !accepted && (
        <details open={!offer} className="rounded-2xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {offer ? "Modificar horarios o importe" : "Preparar opciones para coordinar"}
          </summary>
          <div className="pt-3">
            <OfferEditor
              key={offer?.version ?? 0}
              appointmentId={appointment.id}
              today={today}
              defaults={{
                service: offer?.service_label ?? appointment.service,
                total: offer?.total_price ?? defaultPrice,
                discount: offer?.discount ?? 0,
                conditions: offer?.conditions ?? "",
                duration: appointment.duration_minutes,
                slots:
                  offer?.slots
                    .filter((s) => s.start > new Date().toISOString())
                    .map((s) => ({ ...argentinaParts(s.start), duration: s.duration })) ?? [],
              }}
            />
          </div>
        </details>
      )}

      {accepted && appointment.status === "confirmado" && (
        <details className="rounded-2xl border border-border">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
            Cambiar condiciones aceptadas
          </summary>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <p className="text-sm text-muted-foreground text-pretty">
              Las condiciones aceptadas quedan guardadas en el historial. El turno vuelve a esperar la aceptación del
              cliente y el horario se libera hasta que acepte de nuevo con el mismo enlace.
            </p>
            <ActionForm
              action={reopenOffer}
              submitLabel="Reabrir propuesta"
              submitClassName={secondaryButtonClass}
              confirmText="¿Reabrir la propuesta? El cliente tendrá que aceptarla de nuevo."
            >
              <input type="hidden" name="appointment_id" value={appointment.id} />
              <Field label="Motivo" htmlFor="reopen-reason">
                <input
                  id="reopen-reason"
                  name="reason"
                  maxLength={300}
                  placeholder="Ej.: el cliente sumó un vehículo"
                  className={`${fieldClass} text-base md:text-sm`}
                />
              </Field>
            </ActionForm>
          </div>
        </details>
      )}

      {events.length > 0 && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">Historial de la propuesta</summary>
          <ol className="flex flex-col gap-1.5 text-muted-foreground">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2 tabular-nums">
                <span>{formatDateTime(e.created_at)}</span>
                <span className="text-foreground">{`${EVENT_LABEL[e.kind] ?? e.kind} · v${e.version}`}</span>
                <span>{e.actor_label}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </Card>
  )
}

export function OfferAcceptanceForm({
  offer,
  appointmentId,
  status,
}: {
  offer: Offer | null
  appointmentId: string
  status: string
}) {
  if (!offer || status !== "esperando_cliente" || ["aceptada", "anulada"].includes(offer.status)) return null
  return (
    <Card className="flex flex-col gap-3 border-primary/40">
      <SectionTitle>Confirmar el turno acordado</SectionTitle>
      <p className="text-sm text-pretty">
        Si el cliente ya aceptó por WhatsApp o teléfono, registrá su aceptación acá.
      </p>
      <p className="text-sm font-medium tabular-nums">
        {offer.service_label} · {money(offer.total_price - offer.discount)}
        {offer.slots.length === 1 ? ` · ${formatDateTime(offer.slots[0].start)}` : ""}
      </p>
      <ActionForm action={acceptLinkedOffer} submitLabel="Cliente aceptó · confirmar turno">
        <input type="hidden" name="appointment_id" value={appointmentId} />
        <input type="hidden" name="offer_version" value={offer.version} />
        {offer.slots.length === 1 ? (
          <input type="hidden" name="slot" value={offer.slots[0].start} />
        ) : (
          <Field label="Horario que aceptó el cliente" htmlFor="accepted-slot">
            <select id="accepted-slot" name="slot" required defaultValue="" className={fieldClass}>
              <option value="" disabled>
                Elegir horario acordado
              </option>
              {offer.slots.map((slot) => (
                <option key={slot.start} value={slot.start}>
                  {formatDateTime(slot.start)} · {slot.duration} min
                </option>
              ))}
            </select>
          </Field>
        )}
      </ActionForm>
    </Card>
  )
}
