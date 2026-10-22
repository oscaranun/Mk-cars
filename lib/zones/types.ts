import type { Ring } from "./geometry"

export type Zone = {
  id: string
  name: string
  neighborhoods: string[]
  polygon: Ring | null
  priority: number
  active: boolean
}
export type OperatingDay = {
  weekday: number
  zone_ids: string[]
  flexible: boolean
  enabled: boolean
  capacity: number
}
export type DayOverride = {
  day: string
  zone_ids: string[]
  flexible: boolean
  enabled: boolean
  capacity: number
  reason: string
}
export type ZoneAvailability = {
  enabled: boolean
  zone: { id: string; name: string } | null
  manual: boolean
  dates: { day: string; remaining: number; full: boolean }[]
}
export type MobileUnit = { id: string; name: string; active: boolean; is_primary: boolean }
export type ServiceType = {
  id: string
  name: string
  minutes_per_vehicle: number
  active: boolean
  is_default: boolean
}
export type ZoneSettings = {
  id: number
  enabled: boolean
  minutes_per_vehicle: number
  horizon_days: number
  day_start: string
  day_end: string
  travel_minutes: number
  buffer_minutes: number
  pause_start: string | null
  pause_end: string | null
}
export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
export const REQUEST_STATUS: Record<string, string> = {
  recibida: "Pendiente de horario",
  espera: "Lista de espera",
  revision: "Revisión de zona",
  propuesta: "Pendiente de aceptación",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
}
