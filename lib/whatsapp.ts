import { normalizeWhatsapp } from "@/lib/booking"

/** International digits without "+" (e.g. 5492615099230), or "" when there is no number. */
export function toWhatsappDigits(phone: string | null | undefined) {
  if (!phone) return ""
  return normalizeWhatsapp(phone) ?? phone.replace(/\D/g, "").replace(/^00/, "")
}

/** Official click-to-chat link. Works on phones (app) and as a universal fallback. */
export function waMeUrl(phone: string | null | undefined, message?: string) {
  const digits = toWhatsappDigits(phone)
  const text = message?.trim()
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`
}

/** Opens the chat directly in WhatsApp Web, skipping the wa.me landing page. */
export function whatsappWebUrl(phone: string | null | undefined, message?: string) {
  const params = new URLSearchParams()
  const digits = toWhatsappDigits(phone)
  if (digits) params.set("phone", digits)
  const text = message?.trim()
  if (text) params.set("text", text)
  return `https://web.whatsapp.com/send?${params.toString().replace(/\+/g, "%20")}`
}
