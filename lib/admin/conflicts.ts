import type { SupabaseClient } from "@supabase/supabase-js"
import { formatDateTime } from "@/lib/admin/format"

export type Conflict = {
  id: string
  confirmed_start: string
  duration_minutes: number
  operator: string | null
  clientName: string | null
  sameOperator: boolean
}

export type ConflictCheck = {
  capacity: number
  travelMinutes: number
  conflicts: Conflict[]
  /** True when confirming would be rejected by the DB (capacity reached or same operator busy). */
  blocked: boolean
}

const MAX_WINDOW_HOURS = 12
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()

/**
 * Confirmed appointments whose busy window (wash duration + travel buffer) overlaps the candidate one.
 * Requests never count: only confirmed turnos occupy the schedule. Mirrors public.appointment_slot_conflicts.
 */
export async function findConflicts(
  supabase: SupabaseClient,
  {
    id,
    start,
    durationMinutes,
    operator,
  }: { id: string; start: string; durationMinutes: number; operator?: string | null },
): Promise<ConflictCheck | null> {
  const { data: settings, error: settingsError } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle()
  if (settingsError) return null
  const capacity = Number(settings?.operational_capacity) || 1
  const travelMinutes = Math.max(0, Number(settings?.travel_minutes) || 0)

  const startMs = new Date(start).getTime()
  const windowStart = startMs - travelMinutes * 60_000
  const windowEnd = startMs + (durationMinutes + travelMinutes) * 60_000

  const { data, error } = await supabase
    .from("appointments")
    .select("id, confirmed_start, duration_minutes, operator, clients(full_name)")
    .eq("status", "confirmado")
    .neq("id", id)
    .gte("confirmed_start", new Date(startMs - MAX_WINDOW_HOURS * 3_600_000).toISOString())
    .lte("confirmed_start", new Date(windowEnd).toISOString())
    .returns<
      { id: string; confirmed_start: string; duration_minutes: number; operator: string | null; clients: { full_name: string } | null }[]
    >()
  if (error) return null

  const conflicts = (data ?? [])
    .filter((a) => {
      const aStart = new Date(a.confirmed_start).getTime()
      const aEnd = aStart + a.duration_minutes * 60_000
      return aStart < windowEnd && windowStart < aEnd
    })
    .map((a) => ({
      id: a.id,
      confirmed_start: a.confirmed_start,
      duration_minutes: a.duration_minutes,
      operator: a.operator,
      clientName: a.clients?.full_name ?? null,
      sameOperator: Boolean(norm(operator)) && norm(a.operator) === norm(operator),
    }))

  return {
    capacity,
    travelMinutes,
    conflicts,
    blocked: conflicts.length >= capacity || conflicts.some((c) => c.sameOperator),
  }
}

export function conflictSummary(check: ConflictCheck) {
  const list = check.conflicts
    .map((c) => `${formatDateTime(c.confirmed_start)} (${c.duration_minutes} min${c.clientName ? `, ${c.clientName}` : ""}${c.sameOperator ? ", mismo operario" : ""})`)
    .join("; ")
  const travel = check.travelMinutes ? ` (incluye ${check.travelMinutes} min de traslado)` : ""
  return `Se superpone${travel} con ${list}.`
}
