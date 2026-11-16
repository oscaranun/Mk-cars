export const GOOGLE_REVIEW_URL = "https://g.page/r/CdKFZuL_ITitECE/review"

export const REVIEW_STATUS: Record<string, string> = {
  pendiente: "Pendiente de solicitar",
  solicitada: "Reseña solicitada",
  recibida: "Reseña recibida",
}

export const REVIEW_SELECT =
  "id, full_name, whatsapp, review_status, review_requested_at, review_requested_by_name, review_request_count, review_received_at, review_received_by_name, review_note"

export type ClientReview = {
  id: string
  full_name: string
  whatsapp: string
  review_status: string
  review_requested_at: string | null
  review_requested_by_name: string | null
  review_request_count: number
  review_received_at: string | null
  review_received_by_name: string | null
  review_note: string | null
}

export function reviewTone(status: string) {
  if (status === "recibida") return "success" as const
  if (status === "solicitada") return "info" as const
  return "neutral" as const
}

/** Short branded link that redirects to the Google review form (see app/calificanos/route.ts). */
export const REVIEW_SHORT_URL = "https://www.mkcars.com.ar/calificanos"

export function buildReviewMessage(fullName: string) {
  const firstName = fullName.trim().split(/\s+/)[0] ?? ""
  return `¡Gracias ${firstName} por elegir MK Cars! 🚗✨
Esperamos que disfrutes tu auto impecable.

Tu opinión es muy importante para nosotros. ¿Nos regalás 1 minuto?

⭐⭐⭐⭐⭐ Calificanos 👉 ${REVIEW_SHORT_URL}

Si algo no salió como esperabas, respondé este mensaje y lo solucionamos.`
}
