"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type OfferResponse = { ok: boolean; message: string }

const TOKEN_RE = /^[0-9a-f]{48}$/
const ACTIONS = ["aceptar", "pide_alternativas", "mas_adelante"]

export async function respondToOffer(token: string, action: string, version: number, start: string | null, message: string): Promise<OfferResponse> {
  if (!TOKEN_RE.test(token) || !ACTIONS.includes(action) || !Number.isInteger(version)) {
    return { ok: false, message: "Enlace inválido." }
  }
  if (action === "aceptar" && (!start || Number.isNaN(Date.parse(start)))) {
    return { ok: false, message: "Elegí uno de los horarios." }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: "Servicio no disponible. Escribinos por WhatsApp." }

  const { error } = await supabase.rpc("respond_appointment_offer", {
    p_token: token,
    p_action: action,
    p_version: version,
    p_start: action === "aceptar" ? start : null,
    p_message: message.slice(0, 500),
  })
  if (error) {
    console.error("[offer] respond error:", error.code, error.message)
    return { ok: false, message: error.code === "P0001" ? error.message : "No pudimos registrar tu respuesta. Volvé a intentar." }
  }
  revalidatePath(`/propuesta/${token}`)
  return {
    ok: true,
    message:
      action === "aceptar"
        ? "¡Listo! Tu turno quedó confirmado."
        : action === "pide_alternativas"
          ? "Le avisamos a MK Cars. Te van a enviar otros horarios por WhatsApp."
          : "Perfecto, lo coordinamos más adelante.",
  }
}
