import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, MessageCircle } from "lucide-react"
import { completeAppointment, manageAppointment } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
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
  created_at: string
  clients: { id: string; full_name: string; whatsapp: string; email: string | null } | null
  vehicles: { category: string; brand: string | null; model: string | null } | null
  inquiries: { notes: string | null } | null
  services: { id: string; performed_at: string; final_price: number; amount_paid: number }[]
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
         operator, water_supply, created_at,
         clients(id, full_name, whatsapp, email), vehicles(category, brand, model), inquiries(notes),
         services(id, performed_at, final_price, amount_paid)`,
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

  const start = appt.confirmed_start ?? appt.requested_start
  const startParts = argentinaParts(start)
  const today = todayArgentina()
  const nowParts = argentinaParts(new Date())
  const pending = appt.status === "solicitado" || appt.status === "reprogramado"
  const canReschedule = pending || appt.status === "confirmado"
  const canCancel = canReschedule
  const service = appt.services[0]
  const vehicleLabel = appt.vehicles
    ? [VEHICLE_CATEGORY[appt.vehicles.category] ?? appt.vehicles.category, appt.vehicles.brand, appt.vehicles.model].filter(Boolean).join(" ")
    : "—"

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
              {appt.confirmed_start ? "Confirmado para " : "Solicitado para "}
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
            <DetailRow label="Fecha solicitada">
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
        </Card>

        <div className="flex flex-col gap-6">
          {pending && (
            <Card className="flex flex-col gap-4">
              <SectionTitle>Confirmar turno</SectionTitle>
              <p className="text-sm text-muted-foreground">
                Ajustá el horario si lo acordaste distinto con el cliente. Se valida el horario de atención y que no se superponga con otros
                turnos confirmados.
              </p>
              <ActionForm action={manageAppointment} submitLabel="Confirmar turno">
                <input type="hidden" name="id" value={appt.id} />
                <input type="hidden" name="action" value="confirm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Fecha" htmlFor="confirm-date">
                    <input id="confirm-date" name="date" type="date" required min={today} defaultValue={startParts.date} className={fieldClass} />
                  </Field>
                  <Field label="Hora" htmlFor="confirm-time">
                    <input id="confirm-time" name="time" type="time" required min="09:00" max="18:00" step={900} defaultValue={startParts.time} className={fieldClass} />
                  </Field>
                  <Field label="Duración (min)" htmlFor="confirm-duration">
                    <input id="confirm-duration" name="duration" type="number" min={15} max={540} step={15} defaultValue={appt.duration_minutes} className={fieldClass} />
                  </Field>
                  <Field label="Precio acordado" htmlFor="confirm-price">
                    <input id="confirm-price" name="agreed_price" inputMode="decimal" placeholder="Opcional" defaultValue={appt.agreed_price ?? ""} className={fieldClass} />
                  </Field>
                  <Field label="Operario asignado" htmlFor="confirm-operator" className="sm:col-span-2">
                    <input id="confirm-operator" name="operator" placeholder="Opcional" defaultValue={appt.operator ?? ""} className={fieldClass} />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}

          {appt.status === "confirmado" && (
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

          {canReschedule && (
            <Card className="flex flex-col gap-4">
              <SectionTitle>Reprogramar</SectionTitle>
              <p className="text-sm text-muted-foreground">El turno vuelve a quedar pendiente de confirmación con el nuevo horario.</p>
              <ActionForm action={manageAppointment} submitLabel="Reprogramar" submitClassName={secondaryButtonClass} inline>
                <input type="hidden" name="id" value={appt.id} />
                <input type="hidden" name="action" value="reschedule" />
                <Field label="Nueva fecha" htmlFor="re-date" className="w-44">
                  <input id="re-date" name="date" type="date" required min={today} className={fieldClass} />
                </Field>
                <Field label="Hora" htmlFor="re-time" className="w-32">
                  <input id="re-time" name="time" type="time" required min="09:00" max="18:00" step={900} className={fieldClass} />
                </Field>
              </ActionForm>
            </Card>
          )}

          {(pending || canCancel) && (
            <Card className="flex flex-wrap gap-3">
              {pending && (
                <ActionForm
                  action={manageAppointment}
                  submitLabel="Rechazar solicitud"
                  submitClassName={dangerButtonClass}
                  confirmText="¿Rechazar esta solicitud de turno?"
                  inline
                >
                  <input type="hidden" name="id" value={appt.id} />
                  <input type="hidden" name="action" value="reject" />
                </ActionForm>
              )}
              {canCancel && (
                <ActionForm
                  action={manageAppointment}
                  submitLabel="Cancelar turno"
                  submitClassName={dangerButtonClass}
                  confirmText="¿Cancelar este turno?"
                  inline
                >
                  <input type="hidden" name="id" value={appt.id} />
                  <input type="hidden" name="action" value="cancel" />
                </ActionForm>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
