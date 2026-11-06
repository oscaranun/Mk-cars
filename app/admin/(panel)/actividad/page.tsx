import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin/auth"
import { EmptyState, PageHeader } from "@/components/admin/ui"
import { formatDateTime } from "@/lib/admin/format"

export const metadata: Metadata = { title: "Historial de cambios" }

type Entry = { id: number; actor_email: string | null; entity: string; action: string; detail: string | null; created_at: string; kind: "panel" | "estado" }

export default async function ActividadPage() {
  const { supabase } = await requireAdmin()
  const [{ data: panel }, { data: statuses }] = await Promise.all([
    supabase.from("activity_log").select("id, actor_email, entity, action, detail, created_at").order("created_at", { ascending: false }).limit(150),
    supabase.from("status_history").select("id, entity, from_status, to_status, changed_at, changed_by_email").order("changed_at", { ascending: false }).limit(150),
  ])

  const entries: Entry[] = [
    ...(panel ?? []).map((e) => ({ ...e, kind: "panel" as const })),
    ...(statuses ?? []).map((s) => ({
      id: Number(s.id) || 0,
      actor_email: (s as { changed_by_email?: string | null }).changed_by_email ?? null,
      entity: s.entity,
      action: "cambio de estado",
      detail: `${s.from_status ?? "—"} → ${s.to_status}`,
      created_at: s.changed_at,
      kind: "estado" as const,
    })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 200)

  return (
    <>
      <PageHeader title="Historial de cambios" description="Quién hizo qué y cuándo en todo el panel. Se muestran los últimos 200 movimientos." />
      {entries.length === 0 ? (
        <EmptyState>Todavía no hay cambios registrados.</EmptyState>
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-card">
          {entries.map((e) => (
            <li key={`${e.kind}-${e.id}-${e.created_at}`} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
              <time className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-36">{formatDateTime(e.created_at)}</time>
              <p className="min-w-0 flex-1">
                <span className="font-medium capitalize">{e.entity}</span> · {e.action}
                {e.detail && <span className="text-muted-foreground"> · {e.detail}</span>}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">{e.actor_email ?? "Sistema"}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
