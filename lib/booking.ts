export const AR_TIMEZONE = "America/Argentina/Mendoza"

// Argentina has no DST, so a fixed -03:00 offset is exact.
export function toArgentinaTimestamp(date: string, time: string) {
  const [h, m] = time.split(":")
  return `${date}T${h.padStart(2, "0")}:${m ?? "00"}:00-03:00`
}

export function formatArgentinaDateTime(value: string | Date) {
  return new Date(value).toLocaleString("es-AR", {
    timeZone: AR_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  })
}

export const WHATSAPP_DEFAULT_PREFIX = "+54 9 261 "

function normalizeArgentineLocal(input: string): string | null {
  let digits = input
  if (digits.startsWith("9")) digits = digits.slice(1)
  if (digits.startsWith("0")) digits = digits.slice(1)

  if (digits.length === 7) digits = `261${digits}`
  if (digits.length === 9 && digits.startsWith("15")) digits = `261${digits.slice(2)}`

  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2)
        break
      }
    }
  }

  if (digits.length === 10) return digits
  // The form is prefilled with "+54 9 261", so a customer may type their full number again after it.
  if (digits.length > 10 && digits.startsWith("261")) return normalizeArgentineLocal(digits.slice(3))
  return null
}

/**
 * Normalizes a WhatsApp number to international digits (no "+").
 * Argentine numbers become 549 + area + number; local numbers default to Mendoza (261).
 * Numbers from other countries must include their country code (e.g. +34, +1).
 */
export function normalizeWhatsapp(raw: string) {
  const hasInternationalPrefix = /^\s*(\+|00)/.test(raw)
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)

  if (digits.startsWith("54")) {
    const local = normalizeArgentineLocal(digits.slice(2))
    return local ? `549${local}` : null
  }

  const isInternational = /^[1-9]\d{7,14}$/.test(digits)
  if (hasInternationalPrefix) return isInternational ? digits : null

  const local = normalizeArgentineLocal(digits)
  if (local) return `549${local}`
  return isInternational && digits.length >= 11 ? digits : null
}

export function resolveSource(params: { utmSource?: string | null; ref?: string | null; referrer?: string | null }) {
  const explicit = (params.utmSource || params.ref || "").trim().toLowerCase()
  if (explicit) return explicit.slice(0, 40)

  const referrer = (params.referrer || "").toLowerCase()
  if (referrer.includes("instagram")) return "instagram"
  if (referrer.includes("facebook") || referrer.includes("fb.")) return "facebook"
  if (referrer.includes("google")) return "google"
  if (referrer.includes("tiktok")) return "tiktok"
  return "web"
}
