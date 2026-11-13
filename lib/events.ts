import { createServiceClient } from "@/lib/supabase/service"

export type EventFlyer = {
  id: string
  slug: string
  title: string
  event_date: string | null
  place: string | null
  description: string | null
  button_label: string
  ends_on: string | null
  active: boolean
}

export const EVENT_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const EVENT_ORIGIN_RE = /^evento:[a-z0-9]+(-[a-z0-9]+)*$/

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
}

export function formatEventDate(iso: string | null) {
  if (!iso) return ""
  const [y, m, d] = iso.split("-").map(Number)
  const text = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(y, m - 1, d),
  )
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function isEventOver(event: Pick<EventFlyer, "active" | "ends_on" | "event_date">, today: string) {
  if (!event.active) return true
  const last = event.ends_on ?? event.event_date
  return !!last && last < today
}

export async function getEventBySlug(slug: string): Promise<EventFlyer | null> {
  if (!EVENT_SLUG_RE.test(slug) || slug.length > 60) return null
  const client = createServiceClient()
  if (!client) return null
  const { data, error } = await client
    .from("events")
    .select("id, slug, title, event_date, place, description, button_label, ends_on, active")
    .eq("slug", slug)
    .maybeSingle()
  if (error) {
    console.error("[events] load failed:", error.code)
    return null
  }
  return data as EventFlyer | null
}
