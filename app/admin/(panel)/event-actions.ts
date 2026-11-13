"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isValidDate } from "@/lib/admin/format"
import { EVENT_SLUG_RE, slugify } from "@/lib/events"
import type { ActionState } from "./crm-actions"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (message: string): ActionState => ({ ok: false, message })
const text = (data: FormData, key: string, max = 300) => String(data.get(key) ?? "").trim().slice(0, max)

async function session() {
  const supabase = await createClient()
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isAdmin } = await supabase.rpc("is_admin")
  if (isAdmin !== true) return null
  return { supabase, email: user.email ?? null }
}

function done(slug: string, message: string): ActionState {
  revalidatePath("/admin/eventos")
  revalidatePath(`/evento/${slug}`)
  return { ok: true, message }
}

function readFields(data: FormData) {
  const title = text(data, "title", 120)
  const eventDate = text(data, "event_date", 10)
  const endsOn = text(data, "ends_on", 10)
  const fields = {
    title,
    event_date: eventDate || null,
    place: text(data, "place", 120) || null,
    description: text(data, "description", 500) || null,
    button_label: text(data, "button_label", 40) || "Reservá tu turno",
    ends_on: endsOn || null,
  }
  if (title.length < 3) return { error: "Escribí un título de al menos 3 letras." }
  if (eventDate && !isValidDate(eventDate)) return { error: "Revisá la fecha del evento." }
  if (endsOn && !isValidDate(endsOn)) return { error: "Revisá la fecha de vencimiento." }
  if (eventDate && endsOn && endsOn < eventDate) return { error: "El vencimiento no puede ser antes del evento." }
  return { fields }
}

export async function createEvent(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail("Sesión vencida. Volvé a ingresar.")
  const parsed = readFields(data)
  if ("error" in parsed) return fail(parsed.error!)
  const slug = slugify(text(data, "slug", 80) || parsed.fields.title)
  if (slug.length < 2 || !EVENT_SLUG_RE.test(slug)) return fail("Elegí un nombre de link con letras o números.")
  const { error } = await s.supabase.from("events").insert({ ...parsed.fields, slug })
  if (error) {
    if (error.code === "23505") return fail(`Ya existe un evento con el link "${slug}". Elegí otro.`)
    console.error("[events] create failed:", error.code)
    return fail("No se pudo crear el evento.")
  }
  await s.supabase.from("activity_log").insert({ actor_email: s.email, entity: "evento", entity_id: slug, action: "creado" })
  return done(slug, "Evento creado.")
}

export async function updateEvent(_prev: ActionState, data: FormData): Promise<ActionState> {
  const s = await session()
  if (!s) return fail("Sesión vencida. Volvé a ingresar.")
  const id = text(data, "event_id", 36)
  if (!UUID_RE.test(id)) return fail("Evento inválido.")
  const { data: current } = await s.supabase.from("events").select("slug, active").eq("id", id).maybeSingle()
  if (!current) return fail("Evento no encontrado.")

  const op = text(data, "op", 12)
  if (op === "toggle") {
    const { error } = await s.supabase.from("events").update({ active: !current.active }).eq("id", id)
    if (error) return fail("No se pudo actualizar el evento.")
    return done(current.slug, current.active ? "Evento desactivado." : "Evento activado.")
  }
  if (op === "delete") {
    const { error } = await s.supabase.from("events").delete().eq("id", id)
    if (error) return fail("No se pudo eliminar el evento.")
    await s.supabase.from("activity_log").insert({ actor_email: s.email, entity: "evento", entity_id: current.slug, action: "eliminado" })
    return done(current.slug, "Evento eliminado.")
  }

  const parsed = readFields(data)
  if ("error" in parsed) return fail(parsed.error!)
  const { error } = await s.supabase.from("events").update(parsed.fields).eq("id", id)
  if (error) {
    console.error("[events] update failed:", error.code)
    return fail("No se pudo guardar el evento.")
  }
  return done(current.slug, "Cambios guardados.")
}
