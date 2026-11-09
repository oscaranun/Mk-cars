import { Card, SectionTitle } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDateTime } from "@/lib/admin/format"

type CorrectionRow = {
  id: number
  kind: string
  reason: string | null
  actor_name: string | null
  actor_email: string | null
  created_at: string
}

const KIND_LABEL: Record<string, string> = {
  estado_turno: "Estado del turno",
  estado_servicio: "Estado del servicio",
  reprogramacion: "Reprogramación",
  precio_final: "Precio final",
  cobro: "Cobro",
  propina: "Adicional / propina",
  ingreso: "Corrección de ingreso",
  egreso: "Corrección de gasto",
  anulacion: "Anulación",
  rectificacion: "Rectificación",
}

export async function CorrectionHistory({
  entity,
  entityId,
  appointmentId,
}: {
  entity?: string
  entityId?: string
  appointmentId?: string
}) {
  const { supabase } = await requireAdmin()
  let query = supabase
    .from("admin_corrections")
    .select("id, kind, reason, actor_name, actor_email, created_at")
    .order("created_at", { ascending: false })
    .limit(50)
  if (appointmentId) query = query.eq("appointment_id", appointmentId)
  else if (entity && entityId) query = query.eq("entity", entity).eq("entity_id", entityId)
  else return null

  const { data, error } = await query.returns<CorrectionRow[]>()
  if (error || !data?.length) return null

  return (
    <Card>
      <SectionTitle>Historial de correcciones</SectionTitle>
      <ol className="flex flex-col gap-3">
        {data.map((c) => (
          <li key={c.id} className="border-l-2 border-border pl-3 text-sm">
            <p className="font-medium">{KIND_LABEL[c.kind] ?? c.kind}</p>
            {c.reason && <p className="text-muted-foreground">{c.reason}</p>}
            <p className="text-xs text-muted-foreground">
              {c.actor_name ?? c.actor_email ?? "Sistema"} · {formatDateTime(c.created_at)}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  )
}
