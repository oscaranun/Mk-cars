import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { deleteAppointmentPermanently } from "@/app/admin/(panel)/crm-actions"
import { ConfirmAction, dangerTextButtonClass } from "@/components/admin/confirm-action"
import { APPOINTMENT_STATUS } from "@/lib/admin/labels"
import type { DuplicateMatch } from "@/lib/admin/duplicates"

/** Warning shown on a turno's ficha when the same client has another active turno at the same time. */
export function DuplicateNotice({ appointmentId, matches }: { appointmentId: string; matches: DuplicateMatch[] }) {
  return (
    <section
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-amber-200">Turno duplicado</p>
          <p className="text-pretty">
            Este cliente ya tiene {matches.length === 1 ? "otro turno" : `${matches.length} turnos más`} para el mismo día y
            horario. Revisá cuál corresponde y eliminá el que sobra.
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-1 pl-6">
        {matches.map((m) => (
          <li key={m.id}>
            <Link href={`/admin/turnos/${m.id}`} className="underline underline-offset-4 hover:text-foreground">
              Ver el otro turno: {m.service} ({APPOINTMENT_STATUS[m.status] ?? m.status})
            </Link>
          </li>
        ))}
      </ul>
      <div className="pl-4">
        <DuplicateDeleteButton appointmentId={appointmentId} label="Eliminar este turno duplicado" />
      </div>
    </section>
  )
}

export function DuplicateDeleteButton({ appointmentId, label = "Eliminar duplicado" }: { appointmentId: string; label?: string }) {
  return (
    <ConfirmAction
      action={deleteAppointmentPermanently}
      fields={{ id: appointmentId }}
      triggerLabel={label}
      triggerClassName={`${dangerTextButtonClass} min-h-11`}
      title="Eliminar turno duplicado"
      description="Se borra este turno y sus datos vinculados. El otro turno del cliente se conserva. Esta acción no se puede deshacer."
      confirmLabel="Sí, eliminar"
      redirectTo="/admin/turnos"
    />
  )
}
