import type { Tone } from "@/lib/admin/labels"

/** Commercial stage shown to the team, derived from the appointment and its latest proposal. */
export const STAGES = {
  nueva: "Nueva solicitud",
  preparando: "Preparando propuesta",
  pendiente_respuesta: "Pendiente de respuesta",
  otros_turnos: "Solicita otros turnos",
  postergado: "Postergado por el cliente",
  confirmado: "Confirmado",
  reprogramacion: "Reprogramación pendiente",
  realizado: "Realizado",
  cancelado: "Cancelado",
} as const

export type Stage = keyof typeof STAGES

export const OPEN_STAGES: Stage[] = ["nueva", "preparando", "pendiente_respuesta", "otros_turnos", "postergado", "reprogramacion"]

export function stageOf(appt: { status: string; preparing_since?: string | null }, offerStatus?: string | null): Stage {
  switch (appt.status) {
    case "confirmado":
      return "confirmado"
    case "realizado":
      return "realizado"
    case "cancelado":
    case "rechazado":
      return "cancelado"
    case "reprogramado":
      return "reprogramacion"
  }
  if (offerStatus === "pide_alternativas") return "otros_turnos"
  if (offerStatus === "mas_adelante") return "postergado"
  if (offerStatus === "enviada" || appt.status === "esperando_cliente") return "pendiente_respuesta"
  if (appt.preparing_since) return "preparando"
  return "nueva"
}

export function stageTone(stage: Stage): Tone {
  if (stage === "confirmado") return "info"
  if (stage === "realizado") return "success"
  if (stage === "cancelado") return "danger"
  if (stage === "postergado") return "neutral"
  return "warning"
}

/** Latest non-voided proposal per appointment. */
export function latestOffer<T extends { status: string; created_at: string }>(offers: T[] | null | undefined): T | null {
  const live = (offers ?? []).filter((o) => o.status !== "anulada")
  if (!live.length) return null
  return live.reduce((a, b) => (b.created_at > a.created_at ? b : a))
}
