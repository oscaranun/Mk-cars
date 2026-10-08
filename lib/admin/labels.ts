export const INQUIRY_STATUS: Record<string, string> = {
  nueva: "Nueva consulta",
  pendiente_respuesta: "Pendiente de respuesta",
  presupuesto_enviado: "Presupuesto enviado",
  convertida: "Convertida en contratación",
  no_contratado: "No contratado",
  turno_solicitado: "Turno solicitado",
  turno_confirmado: "Turno confirmado",
  servicio_realizado: "Servicio realizado",
  cobrado: "Cobrado",
  cancelado: "Cancelado",
  reprogramado: "Reprogramado",
}

/** Statuses an admin can set by hand. The rest are set automatically by appointments, services and payments. */
export const EDITABLE_INQUIRY_STATUSES = [
  "nueva",
  "pendiente_respuesta",
  "presupuesto_enviado",
  "convertida",
  "no_contratado",
] as const

export const CONVERTED_INQUIRY_STATUSES = ["convertida", "turno_confirmado", "servicio_realizado", "cobrado"]

export const APPOINTMENT_STATUS: Record<string, string> = {
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  reprogramado: "Reprogramado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  realizado: "Realizado",
}

export const PAYMENT_STATUS: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Pago parcial",
  cobrado: "Cobrado",
}

export const PAYMENT_METHOD: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  otro: "Otro",
}

export const VEHICLE_CATEGORY: Record<string, string> = {
  auto: "Auto",
  suv: "SUV",
  pickup: "Pick-up",
}

export const WATER_SUPPLY: Record<string, string> = {
  domicilio: "Agua del domicilio",
  propia: "Agua propia de MK",
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger"

export function appointmentTone(status: string): Tone {
  if (status === "confirmado") return "info"
  if (status === "realizado") return "success"
  if (status === "solicitado" || status === "reprogramado") return "warning"
  if (status === "rechazado" || status === "cancelado") return "danger"
  return "neutral"
}

export function inquiryTone(status: string): Tone {
  if (CONVERTED_INQUIRY_STATUSES.includes(status)) return "success"
  if (status === "no_contratado" || status === "cancelado") return "danger"
  if (status === "nueva" || status === "pendiente_respuesta") return "warning"
  return "info"
}

export function paymentTone(status: string): Tone {
  if (status === "cobrado") return "success"
  if (status === "parcial") return "info"
  return "warning"
}
