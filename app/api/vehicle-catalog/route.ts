import { NextResponse } from "next/server"
import type { CatalogEntry } from "@/lib/vehicle-catalog"

export const revalidate = 3600

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json([] satisfies CatalogEntry[])

  const res = await fetch(
    `${url}/rest/v1/vehicle_catalog?select=id,brand,model,category,aliases&active=eq.true&order=brand,model`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 3600 } },
  )
  if (!res.ok) {
    console.error("[vehicle-catalog] fetch failed:", res.status)
    return NextResponse.json([] satisfies CatalogEntry[], { status: 502 })
  }
  const data = (await res.json()) as CatalogEntry[]
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  })
}
