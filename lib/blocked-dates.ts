export const BLOCKED_DATES_TAG = "blocked-dates"

export type BlockedDate = { day: string; reason: string }

/**
 * `blocked_dates` is admin-only under RLS, so the public site reads upcoming days
 * server-side with the service key. Only the date and reason ever reach the browser.
 */
export async function getUpcomingBlockedDates(fromDate: string): Promise<BlockedDate[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  try {
    const res = await fetch(`${url}/rest/v1/blocked_dates?select=day,reason&day=gte.${fromDate}&order=day.asc&limit=200`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 60, tags: [BLOCKED_DATES_TAG] },
    })
    if (!res.ok) {
      console.error("[blocked-dates] fetch failed:", res.status)
      return []
    }
    return (await res.json()) as BlockedDate[]
  } catch (error) {
    console.error("[blocked-dates] fetch error:", error)
    return []
  }
}
