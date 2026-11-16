import { AR_TIMEZONE } from "@/lib/booking"
import { formatTime, money } from "@/lib/admin/format"

export type BookingMessageData = {
  clientName: string
  address: string
  service: string
  extras: string[]
  vehicles: string[]
  price: number | null
  waterSupply: string | null
  durationMinutes: number
}

const WATER_TEXT: Record<string, string> = {
  domicilio: "agua del domicilio",
  propia: "MK Cars lleva agua",
}

export function longDate(value: string) {
  const s = new Date(value).toLocaleDateString("es-AR", {
    timeZone: AR_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const hour = (value: string) => `${formatTime(value)} hs`

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

const plainMoney = (value: number) => money(value).replace(/\u00a0/g, " ")

function vehicleLines(vehicles: string[]) {
  if (!vehicles.length) return []
  if (vehicles.length === 1) return [`Vehículo: ${vehicles[0]}`]
  return [`Vehículos (${vehicles.length}):`, ...vehicles.map((v) => `• ${v}`)]
}

const priceText = (price: number | null) => (price != null && price > 0 ? plainMoney(price) : "a confirmar")

export function buildConfirmationMessage(d: BookingMessageData, start: string) {
  const details = [
    `Fecha: ${longDate(start)}`,
    `Horario: ${hour(start)}`,
    d.address && `Domicilio: ${d.address}`,
    ...vehicleLines(d.vehicles),
    d.service && `Servicio: ${d.service}`,
    d.extras.length ? `Adicionales: ${d.extras.join(", ")}` : null,
    `Importe total: ${priceText(d.price)}`,
    d.waterSupply && WATER_TEXT[d.waterSupply] ? `Agua: ${WATER_TEXT[d.waterSupply]}` : null,
    d.durationMinutes > 0 ? `Duración estimada: ${formatDuration(d.durationMinutes)}` : null,
  ].filter(Boolean)

  return [
    `Hola ${d.clientName}.`,
    "",
    "Tu reserva en MK Cars — Car Wash Premium quedó CONFIRMADA.",
    "",
    ...details,
    "",
    "Nuestro equipo irá al domicilio indicado en la fecha y horario confirmados.",
    "",
    "Te pedimos que el vehículo esté accesible y que dispongas de agua y electricidad si el servicio contratado lo requiere.",
    "",
    "Si necesitás modificar o cancelar tu reserva, respondé a este mensaje con anticipación.",
    "",
    "Muchas gracias por elegir MK Cars.",
  ].join("\n")
}

export type StatusMessageData = {
  firstName: string
  date: string
  time: string
  address: string
  service: string
  vehicles: string[]
  price: number | null
}

function shortDate(date: string) {
  const s = new Date(`${date}T12:00:00Z`).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function buildStatusMessage(kind: "confirmado" | "reprogramado", d: StatusMessageData) {
  const when = `${shortDate(d.date)} a las ${d.time} hs`
  const intro =
    kind === "confirmado"
      ? [`Hola ${d.firstName}! MK Cars confirma tu turno.`, "", `📅 ${when}`]
      : [`Hola ${d.firstName}! MK Cars reprogramó tu turno.`, "", `📅 Nueva fecha: ${when}`]

  return [
    ...intro,
    ...[
      d.address && `📍 Domicilio: ${d.address}`,
      ...vehicleLines(d.vehicles).map((line, i) => (i === 0 ? `🚗 ${line}` : line)),
      d.service && `🧽 Servicio: ${d.service}`,
      `💵 Precio acordado: ${priceText(d.price)}`,
    ].filter(Boolean),
    "",
    ...(kind === "reprogramado" ? ["Respondé este mensaje para confirmar el nuevo horario.", ""] : []),
    "Gracias por confiar en MK Cars 😃",
  ].join("\n")
}

export function buildProposalMessage(d: BookingMessageData, original: string | null, proposed: string) {
  const originalBlock = original
    ? ["El horario que solicitaste originalmente era:", "", `${longDate(original)} a las ${hour(original)}.`, ""]
    : []

  return [
    `Hola ${d.clientName}.`,
    "",
    "Te contactamos desde MK Cars por tu solicitud de lavado a domicilio.",
    "",
    ...originalBlock,
    "Queremos proponerte esta alternativa:",
    "",
    `Nueva fecha: ${longDate(proposed)}`,
    `Nuevo horario: ${hour(proposed)}`,
    "",
    ...[d.address && `Domicilio: ${d.address}`, ...vehicleLines(d.vehicles), `Importe: ${priceText(d.price)}`].filter(Boolean),
    "",
    "¿Te queda bien esta nueva fecha y horario?",
    "",
    "Respondé:",
    "1. ACEPTO para confirmar la nueva propuesta.",
    "2. OTRO HORARIO para que coordinemos otra alternativa.",
    "",
    "El turno todavía NO está confirmado. Esperamos tu respuesta.",
    "",
    "Muchas gracias.",
    "MK Cars — Car Wash Premium.",
  ].join("\n")
}
