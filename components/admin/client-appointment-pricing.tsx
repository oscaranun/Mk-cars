import { QuickAppointmentControls } from "@/components/admin/quick-appointment-controls"
import { editDemandDetails } from "@/app/admin/(panel)/edit-actions"
import { quickSetCollected } from "@/app/admin/(panel)/edit-actions"
import { removeVehicleFromAppointment, reviewAppointmentVehicle } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { AppointmentVehicleTools, type ClientVehicle } from "@/components/admin/appointment-vehicle-tools"
import { Badge, EmptyState, Field, TextLink, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatDateTime, money } from "@/lib/admin/format"
import {
  APPOINTMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PANEL_VEHICLE_CATEGORY,
  appointmentTone,
  paymentTone,
  vehicleCategoryLabel,
} from "@/lib/admin/labels"

export type PricingLine = {
  appointment_id: string
  position: number
  category: string | null
  price_applied: number | string | null
  needs_review: boolean
  vehicle_id: string | null
  vehicles: { brand: string | null; model: string | null; category: string; category_label: string | null } | null
}

export type PricingAppointment = {
  id: string
  service: string
  status: string
  start: string | null
  payment_status: string
  amount_paid: number | string
  agreed_price: number | string | null
  discount: number | string | null
  adjusted_price: number | string | null
  requested_start: string | null
  confirmed_start: string | null
  service_started_at: string | null
  address: string
  operator: string | null
  duration_minutes: number
  final_price: number | string | null
  lines: PricingLine[]
}

const compactField = `${fieldClass} w-32`

export function ClientAppointmentPricing({
  clientId,
  appointments,
  vehicles,
}: {
  clientId: string
  appointments: PricingAppointment[]
  vehicles: ClientVehicle[]
}) {
  if (!appointments.length) {
    return <EmptyState>Este cliente no tiene turnos abiertos. Creá uno con “Nuevo turno”.</EmptyState>
  }

  return (
    <ul className="flex flex-col gap-4">
      {appointments.map((a) => {
        const total = a.lines.reduce((sum, l) => sum + (l.price_applied != null ? Number(l.price_applied) : 0), 0)
        const due = a.final_price != null ? Number(a.final_price) : total
        const paid = Number(a.amount_paid) || 0
        const lineVehicleIds = new Set(a.lines.map((l) => l.vehicle_id))
        const available = vehicles.filter((v) => !lineVehicleIds.has(v.id))
        return (
          <li key={a.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TextLink href={`/admin/turnos/${a.id}#vehiculos`}>
                {a.service} · {a.start ? formatDateTime(a.start) : "sin horario"}
              </TextLink>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS[a.status] ?? a.status}</Badge>
                <Badge tone={paymentTone(a.payment_status)}>
                  {PAYMENT_STATUS[a.payment_status] ?? a.payment_status}
                </Badge>
              </div>
            </div>

            {a.lines.length ? (
              <ul className="flex flex-col gap-3">
                {a.lines.map((l) => {
                  const category = l.category ?? l.vehicles?.category ?? "auto"
                  const name = [l.vehicles?.brand, l.vehicles?.model].filter(Boolean).join(" ") || "Sin marca/modelo"
                  const key = `${a.id}-${l.position}`
                  return (
                    <li key={key} className="flex flex-col gap-2 rounded-xl bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {`${l.position}. ${name}`}
                          <span className="font-normal text-muted-foreground">{` · ${vehicleCategoryLabel(category, l.vehicles?.category_label)}`}</span>
                        </span>
                        <span className="flex items-center gap-2 tabular-nums">
                          {l.needs_review && <Badge tone="warning">Revisar</Badge>}
                          {l.price_applied != null ? money(l.price_applied) : "Sin precio"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <ActionForm
                          action={reviewAppointmentVehicle}
                          submitLabel="Guardar precio"
                          submitClassName={secondaryButtonClass}
                          inline
                        >
                          <input type="hidden" name="appointment_id" value={a.id} />
                          <input type="hidden" name="position" value={l.position} />
                          <input type="hidden" name="category_label" value={l.vehicles?.category_label ?? ""} />
                          <Field label="Tipo" htmlFor={`cat-${key}`} className="w-32">
                            <select id={`cat-${key}`} name="category" defaultValue={category} className={fieldClass}>
                              {Object.entries(PANEL_VEHICLE_CATEGORY).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Precio del trabajo" htmlFor={`price-${key}`} className="w-32">
                            <input
                              id={`price-${key}`}
                              name="price"
                              inputMode="decimal"
                              placeholder="De lista"
                              defaultValue={l.price_applied ?? ""}
                              className={fieldClass}
                            />
                          </Field>
                        </ActionForm>
                        {a.lines.length > 1 && (
                          <ActionForm
                            action={removeVehicleFromAppointment}
                            submitLabel="Quitar"
                            submitClassName={secondaryButtonClass}
                            confirmText={`¿Quitar ${name} de este turno? Sigue guardado en la ficha del cliente.`}
                            inline
                          >
                            <input type="hidden" name="appointment_id" value={a.id} />
                            <input type="hidden" name="position" value={l.position} />
                          </ActionForm>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground">Este turno todavía no tiene vehículos cargados. Agregalos abajo.</p>
            )}

            <dl className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-semibold">{money(due)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Cobrado</dt>
                <dd className="font-semibold">{money(paid)}</dd>
              </div>
              {due - paid > 0 && (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Saldo</dt>
                  <dd className="font-semibold text-amber-300">{money(due - paid)}</dd>
                </div>
              )}
            </dl>

            <details className="rounded-xl border border-border px-3 py-2">
              <summary className="cursor-pointer py-1 text-muted-foreground hover:text-foreground">
                Agregar vehículo a este turno
              </summary>
              <div className="pt-3">
                <AppointmentVehicleTools
                  appointmentId={a.id}
                  clientId={clientId}
                  canEdit
                  availableVehicles={available}
                  showNewTurnLink={false}
                  idPrefix={`add-${a.id}`}
                />
              </div>
            </details>

            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer font-medium text-electric">
                Editar horario, estado, precio y cobro
              </summary>
              <div className="mt-3">
                <QuickAppointmentControls appointment={a} />
              </div>
            </details>
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-electric">Editar servicio, domicilio y duración</summary>
              <ActionForm
                action={editDemandDetails}
                submitLabel="Guardar detalles"
                submitClassName={secondaryButtonClass}
                className="mt-3"
              >
                <input type="hidden" name="appointment_id" value={a.id} />
                <Field label="Servicio" htmlFor={`service-${a.id}`}>
                  <input
                    id={`service-${a.id}`}
                    name="service"
                    defaultValue={a.service}
                    required
                    minLength={2}
                    maxLength={120}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Domicilio" htmlFor={`address-${a.id}`}>
                  <input
                    id={`address-${a.id}`}
                    name="address"
                    defaultValue={a.address}
                    required
                    minLength={5}
                    maxLength={200}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Duración (minutos)" htmlFor={`duration-${a.id}`}>
                  <input
                    id={`duration-${a.id}`}
                    name="duration"
                    type="number"
                    min={15}
                    max={540}
                    defaultValue={a.duration_minutes}
                    required
                    className={fieldClass}
                  />
                </Field>
                <Field label="Operador" htmlFor={`operator-${a.id}`}>
                  <input
                    id={`operator-${a.id}`}
                    name="operator"
                    defaultValue={a.operator ?? ""}
                    maxLength={80}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Motivo" htmlFor={`details-reason-${a.id}`}>
                  <input
                    id={`details-reason-${a.id}`}
                    name="reason"
                    required
                    minLength={3}
                    maxLength={300}
                    className={fieldClass}
                  />
                </Field>
              </ActionForm>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
