import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteTestBooking } from "@/app/admin/(panel)/crm-actions"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { Card, SectionTitle, dangerButtonClass } from "@/components/admin/ui"
import { getTestBookingSummary } from "@/lib/admin/test-booking"

export async function TestBookingDelete({ supabase, clientId }: { supabase: SupabaseClient; clientId: string }) {
  const { summary, error } = await getTestBookingSummary(supabase, clientId)
  if (!summary) {
    return (
      <Card className="flex flex-col gap-2">
        <SectionTitle>Reserva de prueba</SectionTitle>
        <p className="text-sm text-red-200">{error}</p>
      </Card>
    )
  }

  const { counts } = summary
  const rows = [
    ["Cliente", 1],
    ["Consultas", counts.inquiries],
    ["Turnos", counts.appointments],
    ["Vehículos del turno", counts.appointmentVehicles],
    ["Vehículos del cliente", counts.vehicles],
    ["Servicios", counts.services],
    ["Cobros", counts.payments],
    ["Historial de estados", counts.history],
  ] as const
  const blocked = summary.conflicts.length > 0

  const list = (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-2xl bg-surface px-4 py-3 text-sm">
      {rows.map(([label, n]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium tabular-nums">{n}</dd>
        </div>
      ))}
    </dl>
  )

  return (
    <Card className="flex flex-col gap-4 border-red-400/30">
      <SectionTitle>Eliminar reserva de prueba</SectionTitle>
      <p className="text-sm text-muted-foreground text-pretty">
        {summary.clientName} es un registro de prueba. Se eliminarán únicamente estos registros, que pertenecen solo a este
        cliente:
      </p>
      {list}
      {blocked ? (
        <ul className="flex flex-col gap-1 text-sm text-red-200">
          {summary.conflicts.map((c) => (
            <li key={c}>{c} Por seguridad no se puede eliminar.</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No hay registros compartidos con otros clientes.</p>
      )}
      <ConfirmAction
        action={deleteTestBooking}
        fields={{ client_id: summary.clientId }}
        triggerLabel="Eliminar reserva de prueba"
        triggerClassName={`${dangerButtonClass} w-fit`}
        disabled={blocked}
        title={`¿Eliminar la reserva ${summary.clientName}?`}
        description="Se eliminarán definitivamente los siguientes registros. Esta acción no se puede deshacer."
        redirectTo="/admin/turnos"
      >
        {list}
      </ConfirmAction>
    </Card>
  )
}
