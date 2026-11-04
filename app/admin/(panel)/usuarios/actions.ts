"use server"

import { revalidatePath } from "next/cache"
import { getOwnerUser } from "@/lib/admin/auth"
import { sendPasswordResetEmail } from "@/lib/admin/password-reset"
import { SECTION_KEYS } from "@/lib/admin/permissions"
import { createServiceClient } from "@/lib/supabase/service"
import type { ActionState } from "@/app/admin/(panel)/crm-actions"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const fail = (message: string): ActionState => ({ ok: false, message })
const done = (message: string): ActionState => {
  revalidatePath("/admin/usuarios")
  return { ok: true, message }
}

function parseAccess(data: FormData) {
  const role = data.get("role") === "owner" ? "owner" : "staff"
  const permissions = data
    .getAll("permissions")
    .map(String)
    .filter((p) => SECTION_KEYS.includes(p))
  return { role, permissions: Array.from(new Set(permissions)) }
}

async function ownerContext() {
  const owner = await getOwnerUser()
  const service = createServiceClient()
  if (!owner || !service) return null
  return { owner, service }
}

async function ownerCount(service: NonNullable<ReturnType<typeof createServiceClient>>) {
  const { count } = await service.from("admins").select("user_id", { count: "exact", head: true }).eq("role", "owner")
  return count ?? 0
}

export async function createPanelUser(_prev: ActionState, data: FormData): Promise<ActionState> {
  const ctx = await ownerContext()
  if (!ctx) return fail("Solo el propietario puede administrar usuarios.")

  const fullName = String(data.get("full_name") ?? "").trim().slice(0, 120)
  const email = String(data.get("email") ?? "").trim().toLowerCase()
  const password = String(data.get("password") ?? "")
  const { role, permissions } = parseAccess(data)

  if (!fullName) return fail("Ingresá el nombre.")
  if (!EMAIL_RE.test(email)) return fail("Ingresá un correo válido.")
  if (password.length < 8) return fail("La contraseña debe tener al menos 8 caracteres.")
  if (role === "staff" && permissions.length === 0) return fail("Elegí al menos una sección.")

  const { data: created, error } = await ctx.service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !created.user) {
    console.error("[admin] create user failed:", error?.code)
    if (error?.code === "email_exists") return fail("Ese correo ya está registrado.")
    if (error?.code === "weak_password") return fail("La contraseña es demasiado débil.")
    return fail("No se pudo crear el usuario.")
  }

  const { error: insertError } = await ctx.service
    .from("admins")
    .insert({ user_id: created.user.id, full_name: fullName, role, permissions })
  if (insertError) {
    console.error("[admin] grant access failed:", insertError.code)
    await ctx.service.auth.admin.deleteUser(created.user.id)
    return fail("No se pudo crear el usuario.")
  }

  return done(`Usuario ${email} creado.`)
}

export async function updatePanelUser(_prev: ActionState, data: FormData): Promise<ActionState> {
  const ctx = await ownerContext()
  if (!ctx) return fail("Solo el propietario puede administrar usuarios.")

  const userId = String(data.get("user_id") ?? "")
  if (!UUID_RE.test(userId)) return fail("Usuario inválido.")
  const fullName = String(data.get("full_name") ?? "").trim().slice(0, 120) || null
  const { role, permissions } = parseAccess(data)

  if (role === "staff") {
    if (userId === ctx.owner.id) return fail("No podés quitarte el rol de propietario a vos mismo.")
    if (permissions.length === 0) return fail("Elegí al menos una sección.")
    const { data: current } = await ctx.service.from("admins").select("role").eq("user_id", userId).maybeSingle()
    if (current?.role === "owner" && (await ownerCount(ctx.service)) <= 1) return fail("Tiene que quedar al menos un propietario.")
  }

  const { error } = await ctx.service.from("admins").update({ full_name: fullName, role, permissions }).eq("user_id", userId)
  if (error) {
    console.error("[admin] update user failed:", error.code)
    return fail("No se pudieron guardar los permisos.")
  }
  return done("Permisos guardados.")
}

export async function sendUserPasswordReset(_prev: ActionState, data: FormData): Promise<ActionState> {
  const ctx = await ownerContext()
  if (!ctx) return fail("Solo el propietario puede administrar usuarios.")

  const userId = String(data.get("user_id") ?? "")
  if (!UUID_RE.test(userId)) return fail("Usuario inválido.")
  const { data: found, error } = await ctx.service.auth.admin.getUserById(userId)
  if (error || !found.user?.email) return fail("No se encontró el correo del usuario.")

  const result = await sendPasswordResetEmail(found.user.email)
  if (!result.ok) {
    if (result.code === "rate_limited") return fail("Se enviaron demasiados correos. Esperá unos minutos e intentá de nuevo.")
    return fail("No se pudo enviar el correo.")
  }
  return { ok: true, message: `Enviamos el enlace a ${found.user.email}.` }
}

export async function deletePanelUser(_prev: ActionState, data: FormData): Promise<ActionState> {
  const ctx = await ownerContext()
  if (!ctx) return fail("Solo el propietario puede administrar usuarios.")

  const userId = String(data.get("user_id") ?? "")
  if (!UUID_RE.test(userId)) return fail("Usuario inválido.")
  if (userId === ctx.owner.id) return fail("No podés eliminar tu propio usuario.")

  const { error: revokeError } = await ctx.service.from("admins").delete().eq("user_id", userId)
  if (revokeError) {
    console.error("[admin] revoke access failed:", revokeError.code)
    return fail("No se pudo eliminar el usuario.")
  }
  const { error } = await ctx.service.auth.admin.deleteUser(userId)
  if (error) console.error("[admin] delete auth user failed:", error.code)
  return done("Usuario eliminado.")
}
