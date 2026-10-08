import { AR_TIMEZONE } from "@/lib/booking"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
})

export function money(value: number | string | null | undefined) {
  return moneyFormatter.format(Number(value) || 0)
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("es-AR", { timeZone: AR_TIMEZONE, dateStyle: "short" })
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("es-AR", { timeZone: AR_TIMEZONE, dateStyle: "short", timeStyle: "short" })
}

export function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString("es-AR", { timeZone: AR_TIMEZONE, hour: "2-digit", minute: "2-digit" })
}

/** Returns { date: "YYYY-MM-DD", time: "HH:MM" } in Argentina time. */
export function argentinaParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` }
}

export function todayArgentina() {
  return argentinaParts(new Date()).date
}

export function isValidDate(value: string) {
  if (!DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function isValidTime(value: string) {
  return TIME_RE.test(value)
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Argentina has no DST, so -03:00 is exact. */
export function startOfArgentinaDay(date: string) {
  return `${date}T00:00:00-03:00`
}

export type DateRange = { from: string; to: string; fromISO: string; toISO: string }

export function resolveRange(params: { desde?: string; hasta?: string }, defaultDays = 30): DateRange {
  const today = todayArgentina()
  let to = params.hasta && isValidDate(params.hasta) ? params.hasta : today
  let from = params.desde && isValidDate(params.desde) ? params.desde : addDays(to, -(defaultDays - 1))
  if (from > to) [from, to] = [to, from]
  return { from, to, fromISO: startOfArgentinaDay(from), toISO: startOfArgentinaDay(addDays(to, 1)) }
}

export function whatsappLink(number: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}`
}

export function formatWhatsapp(number: string) {
  const d = number.replace(/\D/g, "")
  if (d.length === 13 && d.startsWith("549")) return `+54 9 ${d.slice(3, 6)} ${d.slice(6, 9)}-${d.slice(9)}`
  return number
}

/** Strips characters that would break a PostgREST `or()` filter. */
export function sanitizeSearch(value: string | undefined) {
  return (value ?? "").replace(/[,()*%\\]/g, " ").trim().slice(0, 60)
}
