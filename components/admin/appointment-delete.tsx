import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteAppointmentPermanently } from "@/app/admin/(panel)/crm-actions"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { Card, dangerButtonClass } from "@/components/admin/ui"

type Preview =
  | { blocked: true; services: number; payments: number }
  | {
      blocked: false
      appointment: number
      appointment_vehicles: number
      inquiry: boolean
      vehicles: number
      client: boolean
      history: number
    }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export async function AppointmentDelete({ supabase, appointmentId }: { supabase: SupabaseClient; appointmentId: string }) {
  const { data, error } = await supabase.rpc("delete_appointment_permanently", {
    p_id: appointmentId,
    p_dry_run: true,
  })
  const preview = data as Preview | null
  if (error) console.error("[admin] delete preview:", error.code, error.message)

  const items: string[] = []
  if (preview && !preview.blocked) {
    items.push("El turno")
    if (preview.appointment_vehicles) items.push(plural(preview.appointment_vehicles, "vehículo asignado al turno", "vehículos asignados al turno"))
    if (preview.inquiry) items.push("La consulta vinculada")
    if (preview.vehicles) items.push(plural(preview.vehicles, "vehículo del cliente (sin otros usos)", "vehículos del cliente (sin otros usos)"))
    if (preview.client) items.push("El cliente (no tiene otras reservas, consultas ni servicios)")
    if (preview.history) items.push(plural(preview.history, "registro de historial", "registros de historial"))
  }

  const blocked = !preview || preview.blocked

  return (
    <Card className="flex flex-col gap-3 border-red-400/20">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Zona de peligro</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          {preview?.blocked
            ? `No se puede eliminar: la reserva tiene ${plural(preview.services, "servicio realizado", "servicios realizados")} y ${plural(preview.payments, "pago registrado", "pagos registrados")}, que deben conservarse.`
            : !preview
              ? "No se pudo verificar qué registros se eliminarían. Recargá la página."
              : "Borra la reserva y sus datos vinculados. No se puede deshacer."}
        </p>
      </div>
      <ConfirmAction
        action={deleteAppointmentPermanently}
        fields={{ id: appointmentId }}
        triggerLabel="Eliminar reserva definitivamente"
        triggerClassName={dangerButtonClass}
        disabled={blocked}
        title="Eliminar reserva definitivamente"
        description="¿Está seguro de que desea eliminar esta reserva de forma definitiva? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar definitivamente"
        redirectTo="/admin/turnos"
      >
        {items.length > 0 && (
          <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm">
            <p className="font-medium">Se eliminará:</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </ConfirmAction>
    </Card>
  )
}
