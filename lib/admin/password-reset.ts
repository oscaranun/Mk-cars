import { headers } from "next/headers"
import { createClient } from "@supabase/supabase-js"

async function resetRedirectUrl() {
  const devUrl = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  if (devUrl) return devUrl
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}/auth/callback`
}

/**
 * Uses the implicit flow so the emailed link works on any device: the recovery
 * tokens arrive in the URL hash and /admin/restablecer turns them into a session.
 */
export async function sendPasswordResetEmail(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { ok: false as const, code: "not_configured" }

  const client = createClient(url, key, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: await resetRedirectUrl() })
  if (error) {
    console.error("[admin] password reset email failed:", error.code ?? error.status)
    return { ok: false as const, code: error.status === 429 ? "rate_limited" : (error.code ?? "unknown") }
  }
  return { ok: true as const }
}
