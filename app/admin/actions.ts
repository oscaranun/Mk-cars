"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type LoginState = { error: string | null }

export async function login(_prev: LoginState, data: FormData): Promise<LoginState> {
  const supabase = await createClient()
  if (!supabase) return { error: "Supabase no está configurado." }

  const email = String(data.get("email") ?? "").trim()
  const password = String(data.get("password") ?? "")
  if (!email || !password) return { error: "Ingresá correo y contraseña." }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error("[admin] login failed:", error.code)
    if (error.code === "email_not_confirmed") return { error: "El correo todavía no fue confirmado." }
    if (error.status === 429) return { error: "Demasiados intentos. Esperá unos minutos." }
    if (error.code === "invalid_credentials") return { error: "Correo o contraseña incorrectos." }
    return { error: "No se pudo iniciar sesión. Intentá nuevamente." }
  }

  redirect("/admin")
}

export async function logout() {
  const supabase = await createClient()
  await supabase?.auth.signOut()
  redirect("/admin/login")
}
