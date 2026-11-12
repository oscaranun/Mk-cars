type Amount = number | string | null | undefined
type ServicePrice = { final_price: Amount }

/** Same priority as appointment_final_price in PostgreSQL; the original quote is history. */
export function appointmentPrice(appointment: {
  agreed_price?: Amount
  adjusted_price?: Amount
  discount?: Amount
  services?: ServicePrice | ServicePrice[] | null
}): number | null {
  const service = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services
  if (service?.final_price != null) return Number(service.final_price)
  if (appointment.adjusted_price != null) return Number(appointment.adjusted_price)
  return appointment.agreed_price == null
    ? null
    : Math.max(0, Number(appointment.agreed_price) - Number(appointment.discount ?? 0))
}
