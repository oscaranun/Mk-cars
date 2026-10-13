import type { SupabaseClient } from "@supabase/supabase-js"

export type Conflict = {
  id: string
  confirmed_start: string
  duration_minutes: number
  operator: string | null
  clientName: string | null
}

export type ConflictCheck = { capacity: number; travelMinutes: number; conflicts: Conflict[] }

const MAX_WINDOW_HOURS = 12

/**
 * Confirmed appointments whose busy window (wash duration + travel buffer) overlaps the candidate one.
 * Requests ("solicitado") never count: only confirmed turnos occupy the schedule.
 * `travel_minutes` is read when present in settings; until it exists the buffer is 0, matching the DB trigger.
 * Grouping by employee / mobile unit can be added here once appointments carry those ids.
 */
export async function findConflicts(
  supabase: SupabaseClient,
  { id, start, durationMinutes }: { id: string; start: string; durationMinutes: number },
): Promise<ConflictCheck | null> {
  const { data: settings, error: settingsError } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle()
  if (settingsError) return null
  const capacity = Number(settings?.operational_capacity) || 1
  const travelMinutes = Math.max(0, Number(settings?.travel_minutes) || 0)

  const startMs = new Date(start).getTime()
  const endMs = startMs + (durationMinutes + travelMinutes) * 60_000
  const windowMs = MAX_WINDOW_HOURS * 3_600_000

  const { data, error } = await supabase
    .from("appointments")
    .select("id, confirmed_start, duration_minutes, operator, clients(full_name)")
    .eq("status", "confirmado")
    .neq("id", id)
    .gte("confirmed_start", new Date(startMs - windowMs).toISOString())
    .lte("confirmed_start", new Date(endMs).toISOString())
    .returns<
      { id: string; confirmed_start: string; duration_minutes: number; operator: string | null; clients: { full_name: string } | null }[]
    >()
  if (error) return null

  const conflicts = (data ?? [])
    .filter((a) => {
      const aStart = new Date(a.confirmed_start).getTime()
      const aEnd = aStart + (a.duration_minutes + travelMinutes) * 60_000
      return aStart < endMs && startMs < aEnd
    })
    .map((a) => ({
      id: a.id,
      confirmed_start: a.confirmed_start,
      duration_minutes: a.duration_minutes,
      operator: a.operator,
      clientName: a.clients?.full_name ?? null,
    }))

  return { capacity, travelMinutes, conflicts }
}
