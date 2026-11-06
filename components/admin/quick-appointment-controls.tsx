import Link from "next/link"
import { quickSetAppointmentPayment, quickSetAppointmentStatus } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { money } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, PAYMENT_METHOD, appointmentTone } from "@/lib/admin/labels"

export type QuickAppointment = {
  id: string
  status: string
  payment_status: string
  amount_paid: number | string
  agreed_price: number | string | null
  discount: number | string | null
}

const QUICK_STATUSES = ["solicitado", "confirmado", "realizado", "cancelado", "rechazado"] as const

export function QuickAppointmentControls({ appointment, index }: { appointment: QuickAppointment; index?: number }) {
  const paid = appointment.payment_status === "pagado"
  const price = Math.max(Number(appointment.agreed_price ?? 0) - Number(appointment.discount ?? 0), 0)
  const statusValue = (QUICK_STATUSES as readonly string[]).includes(appointment.status) ? appointment.status : ""
  const id = appointment.id
  const locked = paid && (appointment.status === "realizado" || appointment.status === "confirmado")

  const forms = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <ActionForm action={quickSetAppointmentStatus} submitLabel="Guardar" submitClassName={secondaryButtonClass} inline>
        <input type="hidden" name="appointment_id" value={id} />
        <label htmlFor={`appt-status-${id}`} className="sr-only">
          Estado del turno
        </label>
        <select id={`appt-status-${id}`} name="status" defaultValue={statusValue} required className={`${fieldClass} lg:w-44`}>
          {!statusValue && (
            <option value="" disabled>
              Cambiar estado…
            </option>
          )}
          {QUICK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPOINTMENT_STATUS[s]}
            </option>
          ))}
        </select>
      </ActionForm>

      <ActionForm action={quickSetAppointmentPayment} submitLabel="Guardar pago" submitClassName={secondaryButtonClass} inline>
        <input type="hidden" name="appointment_id" value={id} />
        <label htmlFor={`appt-pay-${id}`} className="sr-only">
          Estado del pago
        </label>
        <select id={`appt-pay-${id}`} name="payment" defaultValue={paid ? "pagado" : "pendiente"} className={`${fieldClass} lg:w-36`}>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
        </select>
        <label htmlFor={`appt-method-${id}`} className="sr-only">
          Medio de pago
        </label>
        <select id={`appt-method-${id}`} name="method" defaultValue="efectivo" className={`${fieldClass} lg:w-40`}>
          {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label htmlFor={`appt-amount-${id}`} className="sr-only">
          Importe total
        </label>
        <input
          id={`appt-amount-${id}`}
          name="amount"
          inputMode="decimal"
          placeholder={price ? `Importe (${money(price)})` : "Importe"}
          className={`${fieldClass} lg:w-40`}
        />
      </ActionForm>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Turno{index ? ` ${index}` : ""}</span>
        <Badge tone={appointmentTone(appointment.status)}>{APPOINTMENT_STATUS[appointment.status] ?? appointment.status}</Badge>
        <Badge tone={paid ? "success" : appointment.payment_status === "parcial" ? "info" : "warning"}>
          {paid ? `Pagado${Number(appointment.amount_paid) ? ` · ${money(appointment.amount_paid)}` : ""}` : appointment.payment_status === "parcial" ? `Pago parcial (${money(appointment.amount_paid)})` : "Pago pendiente"}
        </Badge>
        <Link href={`/admin/turnos/${id}`} className="text-electric underline-offset-4 hover:underline">
          Ver turno
        </Link>
      </div>

      {locked ? (
        <details className="group">
          <summary className="w-fit cursor-pointer text-sm text-electric underline-offset-4 hover:underline">
            <span className="group-open:hidden">Corregir estado o pago</span>
            <span className="hidden group-open:inline">Cerrar corrección</span>
          </summary>
          <div className="pt-3">{forms}</div>
        </details>
      ) : (
        forms
      )}
    </div>
  )
}
