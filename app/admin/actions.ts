"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient, hasAnyAdmin } from "@/lib/supabase/service"
import { sendPasswordResetEmail } from "@/lib/admin/password-reset"

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

export async function createFirstAdmin(_prev: LoginState, data: FormData): Promise<LoginState> {
  const service = createServiceClient()
  const supabase = await createClient()
  if (!service || !supabase) return { error: "Supabase no está configurado." }

  if (await hasAnyAdmin()) return { error: "Ya existe un administrador. Ingresá con tu cuenta." }

  const email = String(data.get("email") ?? "").trim().toLowerCase()
  const password = String(data.get("password") ?? "")
  const confirm = String(data.get("confirm") ?? "")
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Ingresá un correo válido." }
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." }
  if (password !== confirm) return { error: "Las contraseñas no coinciden." }

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) {
    console.error("[admin] first admin creation failed:", createError?.code)
    if (createError?.code === "weak_password") return { error: "La contraseña es demasiado débil." }
    if (createError?.code === "email_exists") return { error: "Ese correo ya está registrado." }
    return { error: "No se pudo crear el administrador. Intentá nuevamente." }
  }

  const { error: adminError } = await service.from("admins").insert({ user_id: created.user.id, role: "owner" })
  if (adminError) {
    console.error("[admin] could not grant admin role:", adminError.code)
    await service.auth.admin.deleteUser(created.user.id)
    return { error: "No se pudo crear el administrador. Intentá nuevamente." }
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) redirect("/admin/login")
  redirect("/admin")
}

export type ResetRequestState = { ok: boolean; message: string | null }

export async function requestPasswordReset(_prev: ResetRequestState, data: FormData): Promise<ResetRequestState> {
  const email = String(data.get("email") ?? "").trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "Ingresá un correo válido." }

  const result = await sendPasswordResetEmail(email)
  if (!result.ok && result.code === "rate_limited") {
    return { ok: false, message: "Se enviaron demasiados correos. Esperá unos minutos e intentá de nuevo." }
  }
  if (!result.ok && result.code === "not_configured") return { ok: false, message: "Supabase no está configurado." }
  return {
    ok: true,
    message: "Si el correo pertenece a un usuario del panel, te enviamos un enlace para cambiar la contraseña.",
  }
}

export async function logout() {
  const supabase = await createClient()
  await supabase?.auth.signOut()
  redirect("/admin/login")
}
