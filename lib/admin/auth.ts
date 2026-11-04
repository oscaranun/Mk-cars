import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { AdminProfile } from "@/lib/admin/permissions"

export const requireAdmin = cache(async () => {
  const supabase = await createClient()
  if (!supabase) redirect("/admin/login")

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: isAdmin } = await supabase.rpc("is_admin")
  let profile: AdminProfile | null = null
  if (isAdmin === true) {
    const { data } = await supabase
      .from("admins")
      .select("role, permissions, full_name")
      .eq("user_id", user.id)
      .maybeSingle()
    if (data) profile = { role: data.role, permissions: data.permissions ?? [], full_name: data.full_name }
  }
  return { supabase, user, isAdmin: isAdmin === true, profile }
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

/** Owner-only guard for user management actions. */
export async function getOwnerUser() {
  const supabase = await createClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isOwner } = await supabase.rpc("is_owner")
  return isOwner === true ? user : null
}
