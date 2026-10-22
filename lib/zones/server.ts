import "server-only"
import { createServiceClient } from "@/lib/supabase/service"
import type { ServiceType } from "./types"

/** A missing migration keeps the current booking workflow intact. Never enable implicitly. */
export async function isZoneBookingEnabled() {
  const client = createServiceClient()
  if (!client) return false
  const { data, error } = await client.from("zone_booking_settings").select("enabled").eq("id", 1).maybeSingle()
  if (error && !["PGRST205", "42P01"].includes(error.code)) console.error("[zones] settings unavailable:", error.code)
  return !error && data?.enabled === true
}

export async function getZoneServices(): Promise<ServiceType[]> {
  const client = createServiceClient()
  if (!client) return []
  const { data, error } = await client
    .from("zone_service_types")
    .select("id,name,minutes_per_vehicle,active,is_default")
    .eq("active", true)
    .order("name")
    .returns<ServiceType[]>()
  return error ? [] : (data ?? [])
}
