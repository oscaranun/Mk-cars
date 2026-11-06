import type { Metadata } from "next"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin/auth"
import { EmptyState, Field, FilterBar, PageHeader, fieldClass } from "@/components/admin/ui"
import { formatDateTime } from "@/lib/admin/format"
import { ENTITY_LABEL, actorName, entityLabel, fieldLabel, initials, shortValue, type ActivityEntry } from "@/lib/admin/activity"
import { createServiceClient } from "@/lib/supabase/service"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Historial de cambios" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ACTION_TONE: Record<string, string> = {
  creó: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  modificó: "bg-primary/15 text-electric border-primary/30",
  eliminó: "bg-red-500/15 text-red-200 border-red-400/30",
}

export default async function ActividadPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, user } = await requireAdmin()
  const params = await searchParams
  const usuario = params.usuario === "yo" ? user.id : params.usuario && UUID_RE.test(params.usuario) ? params.usuario : undefined
  const entidad = params.entidad && params.entidad in ENTITY_LABEL ? params.entidad : undefined

  let query = supabase
    .from("activity_log")
    .select("id, actor_id, actor_email, actor_name, entity, entity_id, action, detail, changes, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
  if (usuario) query = query.eq("actor_id", usuario)
  if (entidad) query = query.eq("entity", entidad)

  const service = createServiceClient()
  const [{ data }, admins] = await Promise.all([
    query.returns<ActivityEntry[]>(),
    service ? service.from("admins").select("user_id, full_name") : Promise.resolve({ data: [] as { user_id: string; full_name: string | null }[] }),
  ])
  const entries = data ?? []
  const people = (admins.data ?? []).map((a) => ({ id: a.user_id, name: a.full_name?.trim() || "Sin nombre" }))

  return (
    <>
      <PageHeader
        title="Historial de cambios"
        description="Cada alta, cambio o baja que hace un usuario del panel queda registrada con su nombre. Se muestran los últimos 200."
      />

      <FilterBar resetHref="/admin/actividad">
        <Field label="Usuario" htmlFor="usuario" className="md:w-56">
          <select id="usuario" name="usuario" defaultValue={params.usuario ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            <option value="yo">Mis cambios</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sección" htmlFor="entidad" className="md:w-56">
          <select id="entidad" name="entidad" defaultValue={entidad ?? ""} className={fieldClass}>
            <option value="">Todas</option>
            {Object.entries(ENTITY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>

      {entries.length === 0 ? (
        <EmptyState>No hay cambios registrados con estos filtros.</EmptyState>
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-card">
          {entries.map((e) => {
            const name = actorName(e)
            return (
              <li key={e.id} className="flex gap-3 px-4 py-4">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-electric"
                >
                  {initials(name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {e.actor_id ? (
                      <Link href={`/admin/actividad?usuario=${e.actor_id}`} className="font-semibold uppercase tracking-wide hover:text-electric">
                        {name}
                      </Link>
                    ) : (
                      <span className="font-semibold uppercase tracking-wide">{name}</span>
                    )}
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                        ACTION_TONE[e.action] ?? "border-border bg-surface text-muted-foreground",
                      )}
                    >
                      {e.action}
                    </span>
                    <span className="font-medium">{entityLabel(e.entity)}</span>
                    {e.detail && <span className="min-w-0 truncate text-muted-foreground">· {e.detail}</span>}
                  </div>
                  {e.changes && e.changes.length > 0 && (
                    <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {e.changes.slice(0, 6).map((c) => (
                        <li key={c.field}>
                          <span className="capitalize text-foreground/80">{fieldLabel(c.field)}</span>: {shortValue(c.from)}{" "}
                          <span aria-label="pasó a">→</span> <span className="text-foreground">{shortValue(c.to)}</span>
                        </li>
                      ))}
                      {e.changes.length > 6 && <li>y {e.changes.length - 6} cambios más</li>}
                    </ul>
                  )}
                  <time dateTime={e.created_at} className="text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </time>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
