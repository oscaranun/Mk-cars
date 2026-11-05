"use server"

import { revalidatePath } from "next/cache"
import { getAdminClient } from "@/lib/admin/auth"
import type { ActionState } from "@/app/admin/(panel)/crm-actions"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MESSAGES: Record<string, string> = {
  solicitada: "Solicitud registrada.",
  recibida: "Reseña marcada como recibida.",
  pendiente: "Se deshizo la marca de reseña recibida.",
}

export async function setClientReview(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await getAdminClient()
  if (!supabase) return { ok: false, message: "Sesión vencida. Volvé a ingresar." }

  const id = String(data.get("client_id") ?? "")
  const action = String(data.get("review_action") ?? "")
  const note = String(data.get("note") ?? "").trim().slice(0, 500)
  if (!UUID_RE.test(id)) return { ok: false, message: "Cliente inválido." }
  if (!(action in MESSAGES)) return { ok: false, message: "Acción inválida." }

  const { error } = await supabase.rpc("set_client_review", { p_client_id: id, p_action: action, p_note: note || null })
  if (error) {
    console.error("[admin] set_client_review failed:", error.code)
    return { ok: false, message: "No se pudo guardar. Probá de nuevo." }
  }
  revalidatePath("/admin", "layout")
  return { ok: true, message: MESSAGES[action] }
}
