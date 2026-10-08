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

/** Normalizes Argentine mobile numbers to 549 + area + number (13 digits). Defaults to Mendoza (261). */
export function normalizeWhatsapp(raw: string) {
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (digits.startsWith("54")) digits = digits.slice(2)
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

  return digits.length === 10 ? `549${digits}` : null
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
