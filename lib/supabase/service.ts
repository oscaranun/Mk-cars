import { createClient } from "@supabase/supabase-js"

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function hasAnyAdmin() {
  const service = createServiceClient()
  if (!service) return true
  const { count, error } = await service.from("admins").select("user_id", { count: "exact", head: true })
  if (error) {
    console.error("[admin] could not count admins:", error.code)
    return true
  }
  return (count ?? 0) > 0
}
