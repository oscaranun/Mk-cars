import { MessageCircle, Trash2 } from "lucide-react"
import {
  addTurnoNote,
  addVehicle,
  removeVehicle,
  saveTurnoData,
  saveVehicle,
  undoPayments,
} from "@/app/admin/(panel)/pruebas/actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, Field, SectionTitle, dangerButtonClass, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { argentinaParts, formatDateTime, formatWhatsapp, money, whatsappLink } from "@/lib/admin/format"
import {
  APPOINTMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  appointmentTone,
  paymentTone,
  vehicleCategoryLabel,
} from "@/lib/admin/labels"
import type { TurnoFicha as Ficha } from "@/lib/admin/turno-ficha"
import { PaymentForm } from "./payment-form"
import { StatusPanel } from "./status-panel"
import { VehicleFields } from "./vehicle-fields"

const smallButton = `${secondaryButtonClass} min-h-10 px-4`

export function TurnoFicha({ ficha }: { ficha: Ficha }) {
  const when = ficha.start ? argentinaParts(ficha.start) : null
  const vehiclesTotal = ficha.vehicles.reduce((sum, v) => sum + (v.price ?? 0), 0)
  const balance = Math.max(ficha.finalPrice - ficha.paid, 0)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{ficha.contactName || ficha.client.fullName}</h1>
            <Badge tone={appointmentTone(ficha.status)}>{APPOINTMENT_STATUS[ficha.status] ?? ficha.status}</Badge>
            <Badge tone={paymentTone(ficha.paymentStatus)}>{PAYMENT_STATUS[ficha.paymentStatus] ?? ficha.paymentStatus}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {ficha.start ? formatDateTime(ficha.start) : "Sin fecha"} · {ficha.service} · {formatWhatsapp(ficha.client.whatsapp)}
          </p>
        </div>
        {ficha.client.whatsapp && (
          <a
            href={whatsappLink(ficha.client.whatsapp)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            WhatsApp
          </a>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <SectionTitle>Estado</SectionTitle>
            {ficha.cancelReason && ficha.status === "cancelado" && (
              <p className="text-sm text-muted-foreground">Motivo: {ficha.cancelReason}</p>
            )}
            <StatusPanel appointmentId={ficha.id} current={ficha.status} />
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle aside={<span className="text-sm font-semibold tabular-nums">{money(vehiclesTotal)}</span>}>
              Vehículos ({ficha.vehicles.length})
            </SectionTitle>
            <ul className="flex flex-col gap-3">
              {ficha.vehicles.map((v) => (
                <li key={v.position} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-4">
                  <p className="text-sm font-medium">
                    {vehicleCategoryLabel(v.category, v.categoryLabel)}
                    {(v.brand || v.model) && <span className="text-muted-foreground"> · {[v.brand, v.model].filter(Boolean).join(" ")}</span>}
                  </p>
                  <ActionForm action={saveVehicle} submitLabel="Guardar" submitClassName={smallButton}>
                    <input type="hidden" name="appointment_id" value={ficha.id} />
                    <input type="hidden" name="position" value={v.position} />
                    <VehicleFields
                      idPrefix={`v${v.position}`}
                      category={v.category}
                      categoryLabel={v.categoryLabel}
                      brand={v.brand}
                      model={v.model}
                      price={v.price}
                    />
                  </ActionForm>
                  {ficha.vehicles.length > 1 && (
                    <ActionForm
                      action={removeVehicle}
                      submitLabel={
                        <>
                          <Trash2 className="size-4" aria-hidden="true" />
                          Quitar
                        </>
                      }
                      submitClassName={`${dangerButtonClass} min-h-10 px-4`}
                      confirmText="¿Quitar este vehículo del turno?"
                    >
                      <input type="hidden" name="appointment_id" value={ficha.id} />
                      <input type="hidden" name="position" value={v.position} />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
            <details className="rounded-2xl border border-dashed border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">+ Agregar otro vehículo a este turno</summary>
              <div className="mt-4">
                <ActionForm action={addVehicle} submitLabel="Agregar vehículo" resetOnSuccess>
                  <input type="hidden" name="appointment_id" value={ficha.id} />
                  <VehicleFields idPrefix="new" />
                </ActionForm>
              </div>
            </details>
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle>Datos del turno</SectionTitle>
            <ActionForm action={saveTurnoData} submitLabel="Guardar cambios">
              <input type="hidden" name="appointment_id" value={ficha.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre en este turno" htmlFor="d-name">
                  <input id="d-name" name="contact_name" defaultValue={ficha.contactName ?? ficha.client.fullName} className={fieldClass} />
                </Field>
                <Field label="Servicio" htmlFor="d-service">
                  <input id="d-service" name="service" defaultValue={ficha.service} className={fieldClass} />
                </Field>
                <Field label="Fecha" htmlFor="d-date">
                  <input id="d-date" name="date" type="date" defaultValue={when?.date} className={fieldClass} />
                </Field>
                <Field label="Hora" htmlFor="d-time">
                  <input id="d-time" name="time" type="time" defaultValue={when?.time} className={fieldClass} />
                </Field>
                <Field label="Dirección" htmlFor="d-address" className="sm:col-span-2">
                  <input id="d-address" name="address" defaultValue={ficha.address} required className={fieldClass} />
                </Field>
                <Field label="Barrio" htmlFor="d-hood">
                  <input id="d-hood" name="neighborhood" defaultValue={ficha.neighborhood ?? ""} className={fieldClass} />
                </Field>
                <Field label="Operario" htmlFor="d-op">
                  <input id="d-op" name="operator" defaultValue={ficha.operator ?? ""} className={fieldClass} />
                </Field>
                <Field label="Descuento ($)" htmlFor="d-discount">
                  <input id="d-discount" name="discount" inputMode="numeric" defaultValue={ficha.discount || ""} className={fieldClass} placeholder="0" />
                </Field>
              </div>
            </ActionForm>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <SectionTitle>Pagos</SectionTitle>
            <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-surface/60 p-3 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="font-semibold tabular-nums">{money(ficha.finalPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Pagado</dt>
                <dd className="font-semibold tabular-nums text-emerald-300">{money(ficha.paid)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Saldo</dt>
                <dd className="font-semibold tabular-nums text-amber-200">{money(balance)}</dd>
              </div>
            </dl>
            {ficha.discount > 0 && (
              <p className="text-xs text-muted-foreground">
                Vehículos {money(vehiclesTotal)} − descuento {money(ficha.discount)}
              </p>
            )}
            {ficha.payments.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-sm">
                {ficha.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {formatDateTime(p.paidAt)} · {PAYMENT_METHOD[p.method] ?? p.method}
                      {p.kind !== "servicio" && " · adicional"}
                    </span>
                    <span className="tabular-nums">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            {balance > 0 && ficha.status !== "cancelado" && <PaymentForm appointmentId={ficha.id} balance={money(balance)} />}
            {ficha.paid > 0 && (
              <ActionForm
                action={undoPayments}
                submitLabel="Anular pagos"
                submitClassName={`${dangerButtonClass} min-h-10 px-4`}
                confirmText="¿Anular todos los pagos de este turno?"
              >
                <input type="hidden" name="appointment_id" value={ficha.id} />
              </ActionForm>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <SectionTitle>Notas</SectionTitle>
            <ActionForm action={addTurnoNote} submitLabel="Agregar nota" submitClassName={smallButton} resetOnSuccess>
              <input type="hidden" name="appointment_id" value={ficha.id} />
              <label htmlFor="n-body" className="sr-only">
                Nueva nota
              </label>
              <textarea id="n-body" name="body" rows={2} className={`${fieldClass} py-2`} placeholder="Ej: tocar timbre del portón" />
            </ActionForm>
            {ficha.notes.length > 0 && (
              <ul className="flex flex-col gap-2">
                {ficha.notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-surface/60 p-3 text-sm">
                    <p className="text-pretty">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.authorEmail ?? "—"} · {formatDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionTitle>Cliente</SectionTitle>
            <dl className="flex flex-col gap-1 text-sm">
              <dt className="sr-only">Nombre</dt>
              <dd className="font-medium">{ficha.client.fullName}</dd>
              <dt className="sr-only">WhatsApp</dt>
              <dd className="text-muted-foreground">{formatWhatsapp(ficha.client.whatsapp)}</dd>
              {ficha.client.email && (
                <>
                  <dt className="sr-only">Correo</dt>
                  <dd className="text-muted-foreground">{ficha.client.email}</dd>
                </>
              )}
            </dl>
          </Card>

          <Card className="flex flex-col gap-3">
            <SectionTitle>Historial</SectionTitle>
            <ul className="flex flex-col gap-1.5 text-sm">
              {ficha.history.map((h, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{APPOINTMENT_STATUS[h.to] ?? h.to}</span>
                  <span className="text-muted-foreground">{formatDateTime(h.at)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-2 text-muted-foreground">
                <span>Creado</span>
                <span>{formatDateTime(ficha.createdAt)}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
