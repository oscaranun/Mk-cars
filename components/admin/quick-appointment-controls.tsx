"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { appointmentPrice } from "@/lib/admin/appointment-price"
import {
  quickAddTip,
  quickAdjustPrice,
  quickReschedule,
  quickSetCollected,
  quickSetServiceState,
  quickSetTurnStatus,
} from "@/app/admin/(panel)/edit-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { argentinaParts, money, todayArgentina } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, PAYMENT_METHOD, appointmentTone } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export type QuickAppointment = {
  id: string
  status: string
  payment_status: string
  amount_paid: number | string
  agreed_price: number | string | null
  discount: number | string | null
  adjusted_price?: number | string | null
  requested_start?: string | null
  confirmed_start?: string | null
  preparing_since?: string | null
  service_started_at?: string | null
  services?: { final_price: number | string | null } | { final_price: number | string | null }[] | null
}

const TURN_OPTIONS = [
  ["solicitado", "Solicitado"],
  ["esperando_cliente", "Propuesta enviada"],
  ["confirmado", "Confirmado"],
  ["cancelado", "Cancelado"],
] as const

const SERVICE_OPTIONS = [
  ["pendiente", "Pendiente"],
  ["en_proceso", "En proceso"],
  ["realizado", "Realizado"],
] as const

const compactField = cn(fieldClass, "min-w-0 flex-1")
const saveClass = cn(secondaryButtonClass, "shrink-0")

function serviceState(a: QuickAppointment) {
  if (a.status === "realizado") return "realizado"
  if (a.service_started_at) return "en_proceso"
  return "pendiente"
}

function turnValue(status: string) {
  if (status === "realizado") return "confirmado"
  if (status === "reprogramado") return "esperando_cliente"
  if (status === "rechazado") return "cancelado"
  return status
}

export function QuickAppointmentControls({
  appointment,
  index,
  showDetailLink = true,
}: {
  appointment: QuickAppointment
  index?: number
  showDetailLink?: boolean
}) {
  const id = appointment.id
  const agreed = Math.max(Number(appointment.agreed_price ?? 0) - Number(appointment.discount ?? 0), 0)
  const final = appointmentPrice(appointment) ?? 0
  const [priceDraft, setPriceDraft] = useState(String(final))
  useEffect(() => setPriceDraft(String(final)), [final])
  const paid = Number(appointment.amount_paid ?? 0)
  const balance = Math.max(final - paid, 0)
  const adjusted = final !== agreed
  const start = appointment.confirmed_start ?? appointment.requested_start ?? null
  const startParts = start ? argentinaParts(start) : null
  const state = serviceState(appointment)
  const payTone =
    appointment.payment_status === "pagado" ? "success" : appointment.payment_status === "parcial" ? "info" : "warning"
  const payLabel =
    appointment.payment_status === "pagado"
      ? "Pagado"
      : appointment.payment_status === "parcial"
        ? "Parcial"
        : "Pago pendiente"

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Turno{index ? ` ${index}` : ""}</span>
        <Badge tone={appointmentTone(appointment.status)}>
          {APPOINTMENT_STATUS[appointment.status] ?? appointment.status}
        </Badge>
        <Badge tone={payTone}>{payLabel}</Badge>
        {showDetailLink && (
          <Link href={`/admin/turnos/${id}`} className="ml-auto text-electric underline-offset-4 hover:underline">
            Ver turno
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Acordado</dt>
          <dd className="tabular-nums">{money(agreed)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Precio final</dt>
          <dd className={cn("tabular-nums", adjusted && "font-semibold text-electric")}>{money(final)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cobrado</dt>
          <dd className="tabular-nums text-emerald-300">{money(paid)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Saldo</dt>
          <dd className={cn("tabular-nums", balance > 0 ? "text-amber-300" : "text-muted-foreground")}>
            {money(balance)}
          </dd>
        </div>
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionForm
          action={quickSetTurnStatus}
          submitLabel="Guardar"
          submitClassName={saveClass}
          inline
          className="flex-nowrap"
        >
          <input type="hidden" name="appointment_id" value={id} />
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Turno
            <select name="status" defaultValue={turnValue(appointment.status)} className={compactField}>
              {TURN_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>

        <ActionForm
          action={quickSetServiceState}
          submitLabel="Guardar servicio"
          submitClassName={saveClass}
          inline
          className="flex-nowrap"
        >
          <input type="hidden" name="appointment_id" value={id} />
          <input type="hidden" name="final_price" value={priceDraft} />
          <input type="hidden" name="original_final_price" value={final} />
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Servicio
            <select name="state" defaultValue={state} className={compactField}>
              {SERVICE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      </div>

      <details className="group rounded-xl border border-border/60">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm text-electric">
          <span className="group-open:hidden">Editar fecha, precio y cobro</span>
          <span className="hidden group-open:inline">Cerrar edición</span>
        </summary>

        <div className="flex flex-col gap-4 border-t border-border/60 p-3">
          <ActionForm action={quickReschedule} submitLabel="Guardar fecha" submitClassName={saveClass} inline>
            <input type="hidden" name="appointment_id" value={id} />
            <p className="basis-full text-xs font-medium text-muted-foreground">
              Fecha y horario <span className="font-normal">(se aceptan fechas pasadas)</span>
            </p>
            <label className="sr-only" htmlFor={`date-${id}`}>
              Fecha
            </label>
            <input
              id={`date-${id}`}
              name="date"
              type="date"
              required
              defaultValue={startParts?.date ?? ""}
              className={compactField}
            />
            <label className="sr-only" htmlFor={`time-${id}`}>
              Hora
            </label>
            <input
              id={`time-${id}`}
              name="time"
              type="time"
              required
              defaultValue={startParts?.time ?? ""}
              className={cn(fieldClass, "w-32")}
            />
            <label className="sr-only" htmlFor={`reason-date-${id}`}>
              Motivo del cambio
            </label>
            <input
              id={`reason-date-${id}`}
              name="reason"
              placeholder="Motivo (opcional)"
              className={cn(fieldClass, "basis-full")}
            />
          </ActionForm>

          <ActionForm action={quickAdjustPrice} submitLabel="Ajustar precio" submitClassName={saveClass} inline>
            <input type="hidden" name="appointment_id" value={id} />
            <p className="basis-full text-xs font-medium text-muted-foreground">
              Precio final <span className="font-normal">(el acordado de {money(agreed)} se conserva)</span>
            </p>
            <label className="sr-only" htmlFor={`price-${id}`}>
              Precio final
            </label>
            <input
              id={`price-${id}`}
              name="price"
              inputMode="decimal"
              required
              value={priceDraft}
              onChange={(event) => setPriceDraft(event.target.value)}
              className={compactField}
            />
            <label className="sr-only" htmlFor={`reason-price-${id}`}>
              Motivo del ajuste
            </label>
            <input
              id={`reason-price-${id}`}
              name="reason"
              required
              minLength={3}
              placeholder="Motivo del ajuste"
              className={cn(fieldClass, "basis-full")}
            />
            <p className="basis-full text-xs text-muted-foreground">
              Este precio también se guarda si marcás el trabajo como realizado.
            </p>
          </ActionForm>

          <ActionForm action={quickSetCollected} submitLabel="Guardar cobro" submitClassName={saveClass} inline>
            <input type="hidden" name="appointment_id" value={id} />
            <p className="basis-full text-xs font-medium text-muted-foreground">
              Importe cobrado <span className="font-normal">(total del servicio, sin propinas)</span>
            </p>
            <label className="sr-only" htmlFor={`paid-${id}`}>
              Importe cobrado
            </label>
            <input
              id={`paid-${id}`}
              name="amount"
              inputMode="decimal"
              required
              defaultValue={paid || final || ""}
              className={compactField}
            />
            <label className="sr-only" htmlFor={`method-${id}`}>
              Medio de pago
            </label>
            <select id={`method-${id}`} name="method" defaultValue="efectivo" className={cn(fieldClass, "w-36")}>
              {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`paid-date-${id}`}>
              Fecha de cobro
            </label>
            <input id={`paid-date-${id}`} name="date" type="date" max={todayArgentina()} className={compactField} />
            <label className="sr-only" htmlFor={`reason-paid-${id}`}>
              Motivo de la corrección
            </label>
            <input
              id={`reason-paid-${id}`}
              name="reason"
              placeholder={paid ? "Motivo (obligatorio si baja el importe)" : "Observación (opcional)"}
              className={cn(fieldClass, "basis-full")}
            />
          </ActionForm>

          <ActionForm
            action={quickAddTip}
            submitLabel="Sumar adicional"
            submitClassName={saveClass}
            inline
            resetOnSuccess
          >
            <input type="hidden" name="appointment_id" value={id} />
            <p className="basis-full text-xs font-medium text-muted-foreground">
              Propina o adicional <span className="font-normal">(se registra aparte del precio)</span>
            </p>
            <label className="sr-only" htmlFor={`tip-${id}`}>
              Importe adicional
            </label>
            <input
              id={`tip-${id}`}
              name="amount"
              inputMode="decimal"
              required
              placeholder="Importe"
              className={compactField}
            />
            <label className="sr-only" htmlFor={`tip-method-${id}`}>
              Medio de pago del adicional
            </label>
            <select id={`tip-method-${id}`} name="method" defaultValue="efectivo" className={cn(fieldClass, "w-36")}>
              {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`tip-notes-${id}`}>
              Detalle del adicional
            </label>
            <input
              id={`tip-notes-${id}`}
              name="notes"
              placeholder="Detalle (ej. propina)"
              className={cn(fieldClass, "basis-full")}
            />
          </ActionForm>
        </div>
      </details>
    </div>
  )
}
