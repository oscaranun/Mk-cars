import type { SupabaseClient } from "@supabase/supabase-js"

/** Cancelled or rejected turnos never count as duplicates: they no longer occupy the schedule. */
const INACTIVE_STATUSES = ["cancelado", "rechazado"]

type Candidate = { id: string; status: string; client_id: string | null; start: string | null }

const minuteKey = (start: string) => {
  const t = new Date(start).getTime()
  return Number.isNaN(t) ? null : Math.floor(t / 60_000)
}

const keyFor = (row: Candidate) => {
  if (!row.client_id || !row.start || INACTIVE_STATUSES.includes(row.status)) return null
  const minute = minuteKey(row.start)
  return minute === null ? null : `${row.client_id}|${minute}`
}

/** Ids of turnos that share client and start time (to the minute) with another active turno. */
export function findDuplicateIds(rows: Candidate[]): Set<string> {
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    const key = keyFor(row)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), row.id])
  }
  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat())
}

export type DuplicateMatch = { id: string; service: string; status: string }

/** Other active turnos of the same client at the same start time as the given one. */
export async function findDuplicatesOf(
  supabase: SupabaseClient,
  { id, clientId, start, status }: { id: string; clientId: string; start: string | null; status: string },
): Promise<DuplicateMatch[]> {
  if (!start || INACTIVE_STATUSES.includes(status)) return []
  const minute = minuteKey(start)
  if (minute === null) return []

  const { data, error } = await supabase
    .from("appointments")
    .select("id, status, service, requested_start, confirmed_start")
    .eq("client_id", clientId)
    .neq("id", id)
    .not("status", "in", `(${INACTIVE_STATUSES.join(",")})`)
    .limit(50)
  if (error) {
    console.error("[admin] duplicate check:", error.code, error.message)
    return []
  }

  return (data ?? [])
    .filter((r) => {
      const otherStart = r.confirmed_start ?? r.requested_start
      return otherStart && minuteKey(otherStart) === minute
    })
    .map((r) => ({ id: r.id, service: r.service, status: r.status }))
}
