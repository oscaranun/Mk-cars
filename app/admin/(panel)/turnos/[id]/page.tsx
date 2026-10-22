import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, MessageCircle } from "lucide-react"
import { completeAppointment, manageAppointment, markWhatsappSent, reviewAppointmentVehicle } from "@/app/admin/(panel)/crm-actions"
import { findConflicts, type ConflictCheck } from "@/lib/admin/conflicts"
import { WhatsappComposer } from "@/components/admin/whatsapp-composer"
import { buildConfirmationMessage, buildProposalMessage, type BookingMessageData } from "@/lib/admin/whatsapp-messages"
import { ActionForm } from "@/components/admin/action-form"
import { TestBookingDelete } from "@/components/admin/test-booking-delete"
import { AppointmentDelete } from "@/components/admin/appointment-delete"
import { isTestClientName } from "@/lib/admin/test-booking"
import {
  Badge,
  Card,
  DetailRow,
  Field,
  SectionTitle,
  TextLink,
  dangerButtonClass,
  fieldClass,
  secondaryButtonClass,
} from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { argentinaParts, formatDateTime, formatWhatsapp, money, todayArgentina, whatsappLink } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, VEHICLE_CATEGORY, WATER_SUPPLY, appointmentTone } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Turno" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Appointment = {
  id: string
  service: string
  extras: string[] | null
  address: string
  requested_start: string
  confirmed_start: string | null
  confirmed_at: string | null
  duration_minutes: number
  status: string
  agreed_price: number | null
  operator: string | null
  water_supply: string
  cancel_reason: string | null
  created_at: string
  clients: { id: string; full_name: string; whatsapp: string; email: string | null } | null
  vehicles: { category: string; brand: string | null; model: string | null } | null
  inquiries: { notes: string | null } | null
  services: { id: string; performed_at: string; final_price: number; amount_paid: number }[]
  appointment_vehicles: {
    position: number
    category: string | null
    price_applied: number | null
    classification: string | null
    needs_review: boolean
    vehicles: { category: string; brand: string | null; model: string | null } | null
  }[]
  appointment_proposals: Proposal[]
  appointment_messages: SentMessage[]
}

type Proposal = {
  id: string
  original_start: string | null
  proposed_start: string
  duration_minutes: number
  status: string
  proposed_at: string
  responded_at: string | null
}

type SentMessage = {
  id: string
  kind: string
  proposal_id: string | null
  marked_sent_at: string
  marked_sent_by_email: string | null
}

const PROPOSAL_STATUS: Record<string, string> = {
  pendiente: "Pendiente de respuesta",
  aceptada: "Aceptada por el cliente",
  rechazada: "El cliente pidió otro horario",
  anulada: "Anulada",
}

type HistoryRow = { from_status: string | null; to_status: string; changed_at: string }

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const { supabase } = await requireAdmin()

  const [{ data: appt }, { data: history }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        `id, service, extras, address, requested_start, confirmed_start, confirmed_at, duration_minutes, status, agreed_price,
         operator, water_supply, cancel_reason, created_at,
         clients(id, full_name, whatsapp, email), vehicles(category, brand, model), inquiries(notes),
         services(id, performed_at, final_price, amount_paid),
         appointment_vehicles(position, category, price_applied, classification, needs_review, vehicles(category, brand, model)),
         appointment_proposals(id, original_start, proposed_start, duration_minutes, status, proposed_at, responded_at),
         appointment_messages(id, kind, proposal_id, marked_sent_at, marked_sent_by_email)`,
      )
      .eq("id", id)
      .maybeSingle()
      .returns<Appointment>(),
    supabase
      .from("status_history")
      .select("from_status, to_status, changed_at")
      .eq("entity", "appointment")
      .eq("entity_id", id)
      .order("changed_at", { ascending: false })
      .returns<HistoryRow[]>(),
  ])
  if (!appt) notFound()

  const status = appt.status
  const isRequest = status === "solicitado" || status === "reprogramado"
  const isConfirmed = status === "confirmado"
  const isWaiting = status === "esperando_cliente"
  const isClosed = status === "cancelado" || status === "rechazado"
  const canEditVehicles = isRequest || isConfirmed || isWaiting

  const proposals = [...(appt.appointment_proposals ?? [])].sort((x, y) => y.proposed_at.localeCompare(x.proposed_at))
  const pendingProposal = proposals.find((p) => p.status === "pendiente") ?? null
  const messagesLog = [...(appt.appointment_messages ?? [])].sort((x, y) => y.marked_sent_at.localeCompare(x.marked_sent_at))
  const confirmationSent =
    isConfirmed && appt.confirmed_at
      ? messagesLog.find((m) => m.kind === "confirmacion" && m.marked_sent_at >= appt.confirmed_at!) ?? null
      : null
  const proposalSent = pendingProposal
    ? messagesLog.find((m) => m.kind === "propuesta" && m.proposal_id === pendingProposal.id) ?? null
    : null
  const acceptedProposal = isConfirmed && proposals[0]?.status === "aceptada" ? proposals[0] : null

  const start = appt.confirmed_start ?? pendingProposal?.proposed_start ?? appt.requested_start
  const startParts = argentinaParts(start)
  const today = todayArgentina()
  const nowParts = argentinaParts(new Date())
  const service = appt.services[0]
  const vehicleLabel = appt.vehicles
    ? [VEHICLE_CATEGORY[appt.vehicles.category] ?? appt.vehicles.category, appt.vehicles.brand, appt.vehicles.model].filter(Boolean).join(" ")
    : "—"
  const lineVehicles = [...(appt.appointment_vehicles ?? [])].sort((a, b) => a.position - b.position)
  const lineTotal = lineVehicles.reduce((sum, v) => sum + (v.price_applied ?? 0), 0)
  const reviewCount = lineVehicles.filter((v) => v.needs_review).length
  const defaultPrice = appt.agreed_price ?? (lineTotal > 0 ? lineTotal : "")

  const conflictCheck = isRequest
    ? await findConflicts(supabase, { id: appt.id, start: appt.requested_start, durationMinutes: appt.duration_minutes, operator: appt.operator })
    : pendingProposal
      ? await findConflicts(supabase, {
          id: appt.id,
          start: pendingProposal.proposed_start,
          durationMinutes: pendingProposal.duration_minutes,
          operator: appt.operator,
        })
      : null

  const messageVehicles = lineVehicles.length
    ? lineVehicles.map((v) => {
        const category = v.category ?? v.vehicles?.category ?? ""
        const name = [v.vehicles?.brand, v.vehicles?.model].filter(Boolean).join(" ")
        const label = VEHICLE_CATEGORY[category] ?? category
        return name ? `${name} (${label})` : label
      })
    : appt.vehicles
      ? [
          [appt.vehicles.brand, appt.vehicles.model].filter(Boolean).join(" ")
            ? `${[appt.vehicles.brand, appt.vehicles.model].filter(Boolean).join(" ")} (${VEHICLE_CATEGORY[appt.vehicles.category] ?? appt.vehicles.category})`
            : VEHICLE_CATEGORY[appt.vehicles.category] ?? appt.vehicles.category,
        ]
      : []
  const messageData: BookingMessageData = {
    clientName: appt.clients?.full_name.trim() ?? "",
    address: appt.address,
    service: appt.service,
    extras: appt.extras ?? [],
    vehicles: messageVehicles.filter(Boolean),
    price: appt.agreed_price,
    waterSupply: appt.water_supply,
    durationMinutes: appt.duration_minutes,
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/admin/turnos" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Turnos
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{appt.service}</h1>
              <Badge tone={appointmentTone(appt.status)}>{APPOINTMENT_STATUS[appt.status] ?? appt.status}</Badge>
            </div>
            <p className="text-sm tabular-nums text-muted-foreground">
              {appt.confirmed_start ? "Confirmado para " : pendingProposal ? "Propuesto para " : "Solicitado para "}
              {formatDateTime(start)} · {appt.duration_minutes} min
            </p>
          </div>
          {appt.clients && (
            <a href={whatsappLink(appt.clients.whatsapp)} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
              <MessageCircle className="size-4 text-whatsapp" aria-hidden="true" />
              Escribir por WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="flex flex-col gap-5">
          <SectionTitle>Datos del turno</SectionTitle>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Cliente">
              {appt.clients ? <TextLink href={`/admin/clientes/${appt.clients.id}`}>{appt.clients.full_name}</TextLink> : "—"}
            </DetailRow>
            <DetailRow label="WhatsApp">
              <span className="tabular-nums">{appt.clients ? formatWhatsapp(appt.clients.whatsapp) : "—"}</span>
            </DetailRow>
            <DetailRow label="Correo">{appt.clients?.email ?? "—"}</DetailRow>
            <DetailRow label="Vehículo">{vehicleLabel}</DetailRow>
            <DetailRow label="Servicio">
              {appt.service}
              {appt.extras?.length ? ` + ${appt.extras.join(", ")}` : ""}
            </DetailRow>
            <DetailRow label="Agua">{WATER_SUPPLY[appt.water_supply] ?? appt.water_supply}</DetailRow>
            <DetailRow label="Domicilio">{appt.address}</DetailRow>
            <DetailRow label="Fecha solicitada originalmente">
              <span className="tabular-nums">{formatDateTime(appt.requested_start)}</span>
            </DetailRow>
            <DetailRow label="Fecha confirmada">
              <span className="tabular-nums">{formatDateTime(appt.confirmed_start)}</span>
            </DetailRow>
            <DetailRow label="Precio acordado">{appt.agreed_price != null ? money(appt.agreed_price) : "—"}</DetailRow>
            <DetailRow label="Operario">{appt.operator ?? "—"}</DetailRow>
            <DetailRow label="Recibido">
              <span className="tabular-nums">{formatDateTime(appt.created_at)}</span>
            </DetailRow>
          </dl>
          {lineVehicles.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-medium">{`Vehículos (${lineVehicles.length})`}</h3>
                {reviewCount > 0 && <Badge tone="warning">{`${reviewCount} a revisar`}</Badge>}
              </div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {lineVehicles.map((v) => {
                  const category = v.category ?? v.vehicles?.category ?? ""
                  const name = [v.vehicles?.brand, v.vehicles?.model].filter(Boolean).join(" ") || "Sin marca/modelo"
                  return (
                    <li key={v.position} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span>
                        {`${v.position}. ${name} · ${VEHICLE_CATEGORY[category] ?? category}`}
                        <span className="text-muted-foreground">
                          {v.classification === "catalogo" ? " · automática" : v.classification === "manual" ? " · manual" : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {v.needs_review && <Badge tone="warning">Revisar</Badge>}
                        {v.price_applied != null ? money(v.price_applied) : "—"}
                      </span>
                      {canEditVehicles && (
                        <div className="w-full">
                          <ActionForm
                            action={reviewAppointmentVehicle}
                            submitLabel={v.needs_review ? "Verificar" : "Cambiar"}
                            submitClassName={secondaryButtonClass}
                            inline
                          >
                            <input type="hidden" name="appointment_id" value={appt.id} />
                            <input type="hidden" name="position" value={v.position} />
                            <Field label={`Tipo del vehículo ${v.position}`} htmlFor={`review-${v.position}`} className="w-44">
                              <select id={`review-${v.position}`} name="category" required defaultValue={category} className={fieldClass}>
                                {Object.entries(VEHICLE_CATEGORY).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </ActionForm>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              {lineTotal > 0 && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  Total estimado <span className="font-medium text-foreground">{money(lineTotal)}</span>
                </p>
              )}
            </div>
          )}

          {appt.inquiries?.notes && (
            <div className="rounded-2xl bg-surface p-4 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">Comentarios del cliente</p>
              <p className="text-pretty">{appt.inquiries.notes}</p>
            </div>
          )}

          {history && history.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Historial</h3>
              <ol className="flex flex-col gap-1.5 text-sm">
                {history.map((h, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2 tabular-nums text-muted-foreground">
                    <span>{formatDateTime(h.changed_at)}</span>
                    <span className="text-foreground">
                      {h.from_status ? `${APPOINTMENT_STATUS[h.from_status] ?? h.from_status} → ` : "Creado como "}
                      {APPOINTMENT_STATUS[h.to_status] ?? h.to_status}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {proposals.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Propuestas de horario</h3>
              <ol className="flex flex-col gap-2 text-sm">
                {proposals.map((p) => (
                  <li key={p.id} className="flex flex-col gap-0.5 tabular-nums">
                    <span>
                      {`${formatDateTime(p.proposed_start)} · ${p.duration_minutes} min`}
                      <span className="text-muted-foreground">{` · ${PROPOSAL_STATUS[p.status] ?? p.status}`}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {`Original ${formatDateTime(p.original_start)} · propuesta el ${formatDateTime(p.proposed_at)}`}
                      {p.responded_at ? ` · respuesta ${formatDateTime(p.responded_at)}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {messagesLog.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-sm font-medium">Mensajes de WhatsApp marcados como enviados</h3>
              <ol className="flex flex-col gap-1.5 text-sm">
                {messagesLog.map((m) => (
                  <li key={m.id} className="flex flex-wrap gap-x-2 tabular-nums text-muted-foreground">
                    <span>{formatDateTime(m.marked_sent_at)}</span>
                    <span className="text-foreground">{m.kind === "confirmacion" ? "Confirmación" : "Propuesta de horario"}</span>
                    {m.marked_sent_by_email && <span>{`por ${m.marked_sent_by_email}`}</span>}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">Registro manual: no indica que el cliente lo haya recibido o leído.</p>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          {isRequest && (
            <Card className="flex flex-col gap-4">
              <SectionTitle>Confirmar turno</SectionTitle>
              <p className="text-sm text-muted-foreground text-pretty">
                {`Confirma exactamente el horario que pidió el cliente: ${formatDateTime(appt.requested_start)}. Si necesitás otro horario, usá "Proponer otro horario".`}
              </p>
              <ConflictNotice check={conflictCheck} />
              {reviewCount > 0 && (
                <p className="rounded-2xl bg-surface p-4 text-sm">
                  {`Hay ${reviewCount} vehículo(s) con categoría a revisar. Verificalos antes de confirmar para que el precio sea correcto.`}
                </p>
              )}
              <ActionForm action={manageAppointment} submitLabel="Confirmar turno">
                <input type="hidden" name="id" value={appt.id} />
                <input type="hidden" name="action" value="confirm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Duración (min)" htmlFor="confirm-duration">
                    <input id="confirm-duration" name="duration" type="number" min={15} max={540} step={15} defaultValue={appt.duration_minutes} className={inputClass} />
                  </Field>
                  <Field label="Importe total acordado" htmlFor="confirm-price">
                    <input id="confirm-price" name="agreed_price" inputMode="decimal" placeholder="A confirmar" defaultValue={defaultPrice} className={inputClass} />
                  </Field>
                  <Field label="Operario / unidad asignada" htmlFor="confirm-operator" className="sm:col-span-2">
                    <input id="confirm-operator" name="operator" placeholder="Opcional" defaultValue={appt.operator ?? ""} className={inputClass} />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}

          {isRequest && (
            <ProposeCard
              title="Proponer otro horario"
              description="El turno no se confirma: queda esperando la aceptación del cliente y se conserva el horario que pidió originalmente."
              submitLabel="Guardar propuesta"
              appt={appt}
              today={today}
              defaultPrice={defaultPrice}
            />
          )}

          {isConfirmed && appt.clients && (
            <Card className="flex flex-col gap-4">
              <SectionTitle>{acceptedProposal ? "Confirmación definitiva por WhatsApp" : "Confirmación por WhatsApp"}</SectionTitle>
              <SentStatus sent={confirmationSent} pendingText="Confirmación de WhatsApp pendiente de envío" />
              <WhatsappComposer
                key={`${appt.confirmed_at}-${appt.agreed_price}`}
                phone={appt.clients.whatsapp}
                initialMessage={buildConfirmationMessage(messageData, appt.confirmed_start ?? start)}
                label={acceptedProposal ? "Enviar confirmación definitiva por WhatsApp" : "Enviar confirmación por WhatsApp"}
              />
              {!confirmationSent && <MarkSentForm id={appt.id} kind="confirmacion" />}
            </Card>
          )}

          {isWaiting && (
            <Card className="flex flex-col gap-4">
              <SectionTitle>Esperando aceptación del cliente</SectionTitle>
              {pendingProposal ? (
                <>
                  <dl className="grid gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-2">
                    <DetailRow label="Horario original">
                      <span className="tabular-nums">{formatDateTime(pendingProposal.original_start)}</span>
                    </DetailRow>
                    <DetailRow label="Horario propuesto">
                      <span className="tabular-nums font-medium">{`${formatDateTime(pendingProposal.proposed_start)} · ${pendingProposal.duration_minutes} min`}</span>
                    </DetailRow>
                  </dl>
                  <ConflictNotice check={conflictCheck} />
                  <SentStatus sent={proposalSent} pendingText="Propuesta de WhatsApp pendiente de envío" />
                  {appt.clients && (
                    <WhatsappComposer
                      key={pendingProposal.id}
                      phone={appt.clients.whatsapp}
                      initialMessage={buildProposalMessage(messageData, pendingProposal.original_start, pendingProposal.proposed_start)}
                      label="Enviar propuesta por WhatsApp"
                    />
                  )}
                  {!proposalSent && <MarkSentForm id={appt.id} kind="propuesta" />}
                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground text-pretty">
                      Registrá la respuesta que recibiste por WhatsApp. El CRM no lee las respuestas del cliente.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <ActionForm
                        action={manageAppointment}
                        submitLabel="Cliente aceptó"
                        confirmText="¿El cliente aceptó el horario propuesto? Se vuelve a verificar la disponibilidad y se confirma el turno."
                        inline
                      >
                        <input type="hidden" name="id" value={appt.id} />
                        <input type="hidden" name="action" value="client_accepted" />
                      </ActionForm>
                      <ActionForm
                        action={manageAppointment}
                        submitLabel="Solicitar otra alternativa"
                        submitClassName={secondaryButtonClass}
                        confirmText="¿El cliente pidió otro horario? La propuesta actual queda como no aceptada."
                        inline
                      >
                        <input type="hidden" name="id" value={appt.id} />
                        <input type="hidden" name="action" value="client_rejected" />
                      </ActionForm>
                    </div>
                  </div>
                </>
              ) : (
                <p className="rounded-2xl bg-surface p-4 text-sm text-pretty">
                  {`El cliente pidió otro horario. Horario solicitado originalmente: ${formatDateTime(appt.requested_start)}. Proponé una nueva alternativa abajo.`}
                </p>
              )}
            </Card>
          )}

          {isWaiting && !pendingProposal && (
            <ProposeCard
              title="Proponer otra alternativa"
              description="Se guarda como nueva propuesta. El turno sigue sin confirmar hasta que el cliente acepte."
              submitLabel="Guardar nueva propuesta"
              appt={appt}
              today={today}
              defaultPrice={defaultPrice}
            />
          )}

          {isConfirmed && (
            <Card className="flex flex-col gap-4">
              <SectionTitle>Marcar como servicio realizado</SectionTitle>
              <ActionForm action={completeAppointment} submitLabel="Registrar servicio realizado">
                <input type="hidden" name="id" value={appt.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Fecha real del lavado" htmlFor="done-date">
                    <input id="done-date" name="date" type="date" required max={today} defaultValue={startParts.date <= today ? startParts.date : today} className={fieldClass} />
                  </Field>
                  <Field label="Hora" htmlFor="done-time">
                    <input id="done-time" name="time" type="time" required defaultValue={startParts.date <= today ? startParts.time : nowParts.time} className={fieldClass} />
                  </Field>
                  <Field label="Tipo de vehículo" htmlFor="done-category">
                    <select id="done-category" name="vehicle_category" required defaultValue={appt.vehicles?.category ?? ""} className={fieldClass}>
                      <option value="" disabled>
                        Elegir
                      </option>
                      {Object.entries(VEHICLE_CATEGORY).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tipo de lavado" htmlFor="done-wash">
                    <input
                      id="done-wash"
                      name="wash_type"
                      required
                      minLength={2}
                      defaultValue={[appt.service, ...(appt.extras ?? [])].join(" + ")}
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Precio acordado" htmlFor="done-agreed">
                    <input id="done-agreed" name="agreed_price" inputMode="decimal" defaultValue={appt.agreed_price ?? ""} className={fieldClass} />
                  </Field>
                  <Field label="Precio final" htmlFor="done-final">
                    <input id="done-final" name="final_price" inputMode="decimal" required defaultValue={appt.agreed_price ?? ""} className={fieldClass} />
                  </Field>
                  <Field label="Operario" htmlFor="done-operator">
                    <input id="done-operator" name="operator" placeholder="Opcional" defaultValue={appt.operator ?? ""} className={fieldClass} />
                  </Field>
                  <Field label="Observaciones" htmlFor="done-notes" className="sm:col-span-2">
                    <textarea id="done-notes" name="notes" rows={3} className={`${fieldClass} py-2.5`} />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}

          {service && (
            <Card className="flex flex-col gap-3">
              <SectionTitle>Servicio registrado</SectionTitle>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatDateTime(service.performed_at)} · Precio final {money(service.final_price)} · Pagado {money(service.amount_paid)}
              </p>
              <Link href={`/admin/cobros?servicio=${service.id}`} className={`${secondaryButtonClass} w-fit`}>
                Ir a cobros
              </Link>
            </Card>
          )}

          {isConfirmed && (
            <ProposeCard
              title="Reprogramar"
              description="El turno deja de estar confirmado y queda esperando la aceptación del cliente con el nuevo horario."
              submitLabel="Reprogramar"
              appt={appt}
              today={today}
              defaultPrice={defaultPrice}
              secondary
            />
          )}

          {(isRequest || isConfirmed || isWaiting) && (
            <Card className="flex flex-col gap-3">
              <SectionTitle>{isRequest ? "Rechazar solicitud" : "Cancelar turno"}</SectionTitle>
              <ActionForm
                action={manageAppointment}
                submitLabel={isRequest ? "Rechazar solicitud" : "Cancelar turno"}
                submitClassName={dangerButtonClass}
                confirmText={isRequest ? "¿Rechazar esta solicitud de turno?" : "¿Cancelar este turno?"}
              >
                <input type="hidden" name="id" value={appt.id} />
                <input type="hidden" name="action" value={isRequest ? "reject" : "cancel"} />
                <Field label="Motivo (opcional)" htmlFor="close-reason">
                  <input id="close-reason" name="reason" maxLength={300} placeholder="Ej.: el cliente no puede ese día" className={inputClass} />
                </Field>
              </ActionForm>
            </Card>
          )}

          {isClosed && (
            <Card className="flex flex-col gap-2">
              <SectionTitle>{status === "cancelado" ? "Motivo de cancelación" : "Motivo del rechazo"}</SectionTitle>
              <p className="text-sm text-pretty">{appt.cancel_reason ?? "Sin motivo registrado."}</p>
            </Card>
          )}

          {appt.clients && isTestClientName(appt.clients.full_name) && (
            <TestBookingDelete supabase={supabase} clientId={appt.clients.id} />
          )}

          <AppointmentDelete supabase={supabase} appointmentId={appt.id} />
        </div>
      </div>
    </>
  )
}

const inputClass = `${fieldClass} text-base md:text-sm`

function ConflictNotice({ check }: { check: ConflictCheck | null }) {
  if (!check || check.conflicts.length === 0) return null
  return (
    <div role="status" className={cn("rounded-2xl p-4 text-sm", check.blocked ? "bg-destructive/10 text-destructive" : "bg-surface")}>
      <p className="font-medium text-pretty">
        {check.blocked
          ? "Horario no disponible: se superpone con otro turno confirmado. No se va a poder confirmar, proponé otro horario."
          : "Hay turnos confirmados cerca de ese horario, pero la capacidad todavía lo permite."}
      </p>
      {check.travelMinutes > 0 && <p className="mt-1 text-xs opacity-80">{`Incluye ${check.travelMinutes} min de traslado.`}</p>}
      <ul className="mt-1 flex flex-col gap-0.5 tabular-nums">
        {check.conflicts.map((c) => (
          <li key={c.id}>
            <TextLink href={`/admin/turnos/${c.id}`}>{formatDateTime(c.confirmed_start)}</TextLink>
            {` · ${c.duration_minutes} min${c.clientName ? ` · ${c.clientName}` : ""}${c.operator ? ` · ${c.operator}` : ""}${c.sameOperator ? " (mismo operario)" : ""}`}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SentStatus({ sent, pendingText }: { sent: SentMessage | null; pendingText: string }) {
  if (!sent) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-2xl bg-amber-300/15 p-3 text-sm font-medium text-amber-100">
        <Badge tone="warning">Pendiente</Badge>
        {pendingText}
      </p>
    )
  }
  return (
    <p className="rounded-2xl bg-surface p-3 text-sm text-pretty tabular-nums">
      {`Marcado como enviado el ${formatDateTime(sent.marked_sent_at)}${sent.marked_sent_by_email ? ` por ${sent.marked_sent_by_email}` : ""}. Esto no confirma que el cliente lo haya recibido o leído.`}
    </p>
  )
}

function MarkSentForm({ id, kind }: { id: string; kind: "confirmacion" | "propuesta" }) {
  return (
    <ActionForm
      action={markWhatsappSent}
      submitLabel="Marcar como enviado"
      submitClassName={secondaryButtonClass}
      confirmText="¿Confirmás que enviaste el mensaje por WhatsApp?"
      inline
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
    </ActionForm>
  )
}

async function ProposeCard({
  title,
  description,
  submitLabel,
  appt,
  today,
  defaultPrice,
  secondary,
}: {
  title: string
  description: string
  submitLabel: string
  appt: Appointment
  today: string
  defaultPrice: number | ""
  secondary?: boolean
}) {
  const slug = submitLabel.toLowerCase().replace(/\W+/g, "-")
  const {supabase}=await requireAdmin()
  const {data:operation}=await supabase.from("zone_booking_settings").select("enabled,day_start,day_end").eq("id",1).maybeSingle()
  const minTime=operation?.enabled?operation.day_start.slice(0,5):"09:00"
  const maxTime=operation?.enabled?operation.day_end.slice(0,5):"18:00"
  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle>{title}</SectionTitle>
      <p className="text-sm text-muted-foreground text-pretty">{description}</p>
      <ActionForm action={manageAppointment} submitLabel={submitLabel} submitClassName={secondary ? secondaryButtonClass : undefined}>
        <input type="hidden" name="id" value={appt.id} />
        <input type="hidden" name="action" value="propose" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nueva fecha" htmlFor={`${slug}-date`}>
            <input id={`${slug}-date`} name="date" type="date" required min={today} className={inputClass} />
          </Field>
          <Field label="Nuevo horario" htmlFor={`${slug}-time`}>
            <input id={`${slug}-time`} name="time" type="time" required min={minTime} max={maxTime} step={900} className={inputClass} />
          </Field>
          <Field label="Duración (min)" htmlFor={`${slug}-duration`}>
            <input id={`${slug}-duration`} name="duration" type="number" min={15} max={540} step={15} defaultValue={appt.duration_minutes} className={inputClass} />
          </Field>
          <Field label="Importe total" htmlFor={`${slug}-price`}>
            <input id={`${slug}-price`} name="agreed_price" inputMode="decimal" placeholder="A confirmar" defaultValue={defaultPrice} className={inputClass} />
          </Field>
          <Field label="Operario / unidad asignada" htmlFor={`${slug}-operator`} className="sm:col-span-2">
            <input id={`${slug}-operator`} name="operator" placeholder="Opcional" defaultValue={appt.operator ?? ""} className={inputClass} />
          </Field>
        </div>
      </ActionForm>
    </Card>
  )
}
