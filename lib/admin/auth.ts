import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const requireAdmin = cache(async () => {
  const supabase = await createClient()
  if (!supabase) redirect("/admin/login")

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: isAdmin } = await supabase.rpc("is_admin")
  return { supabase, user, isAdmin: isAdmin === true }
})

/** For server actions and route handlers: returns null instead of redirecting. */
export async function getAdminClient() {
  const supabase = await createClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isAdmin } = await supabase.rpc("is_admin")
  return isAdmin === true ? supabase : null
}
