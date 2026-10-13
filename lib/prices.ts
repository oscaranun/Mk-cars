export type VehiclePrices = { auto: number; suv: number; pickup: number }

export const PRICES_TAG = "vehicle-prices"
const MAX_PRICE = 10_000_000

export function parsePrices(raw: unknown): VehiclePrices | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const out = {} as VehiclePrices
  for (const key of ["auto", "suv", "pickup"] as const) {
    const n = Number(r[key])
    if (!Number.isInteger(n) || n <= 0 || n > MAX_PRICE) return null
    out[key] = n
  }
  return out
}

/**
 * Prices live only in settings.vehicle_prices (also used by submit_booking).
 * `settings` is admin-only under RLS, so this reads that single column server-side
 * with the service key; the browser never receives the key nor can write prices.
 */
export async function getVehiclePrices(): Promise<VehiclePrices | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/rest/v1/settings?select=vehicle_prices&id=eq.1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 60, tags: [PRICES_TAG] },
    })
    if (!res.ok) {
      console.error("[prices] fetch failed:", res.status)
      return null
    }
    const rows = (await res.json()) as { vehicle_prices: unknown }[]
    return parsePrices(rows[0]?.vehicle_prices)
  } catch (error) {
    console.error("[prices] fetch error:", error)
    return null
  }
}
