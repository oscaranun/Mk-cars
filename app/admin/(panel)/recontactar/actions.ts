"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f-]{36}$/i

function text(value: FormDataEntryValue | null, max = 1000) {
  const v = String(value ?? "").trim()
  return v ? v.slice(0, max) : null
}

/** Records a follow-up contact (or just schedules one) and moves the client's next follow-up date. */
export async function recordFollowUp(formData: FormData) {
  const { supabase } = await requireAdmin()
  const clientId = String(formData.get("client_id") ?? "")
  if (!UUID_RE.test(clientId)) return

  const note = text(formData.get("note"))
  const rawNext = String(formData.get("next_follow_up") ?? "")
  const next = DATE_RE.test(rawNext) ? rawNext : null
  const contacted = formData.get("contacted") === "on"

  if (note || contacted) {
    const { error } = await supabase.from("client_contacts").insert({ client_id: clientId, note, next_follow_up: next })
    if (error) console.error("[admin] client contact insert failed:", error.code, error.message)
  }

  const patch: Record<string, unknown> = { follow_up_at: next, follow_up_note: next ? (note ?? undefined) : null }
  if (contacted) patch.last_contacted_at = new Date().toISOString()
  if (patch.follow_up_note === undefined) delete patch.follow_up_note
  const { error } = await supabase.from("clients").update(patch).eq("id", clientId)
  if (error) console.error("[admin] client follow-up update failed:", error.code, error.message)

  revalidatePath("/admin/recontactar")
  revalidatePath(`/admin/clientes/${clientId}`)
}
