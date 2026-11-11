export type AcceptanceOffer = {
  token: string
  version: number
  status: string
  slots: { start: string; duration: number }[] | null
}

/** Resolve the exact agreement shown to the operator; never accept a newer version silently. */
export function resolveOfferAcceptance(offer: AcceptanceOffer | null, chosenSlot: string, shownVersion?: number) {
  if (!offer || offer.status === "anulada") return { error: "No hay una propuesta disponible para confirmar." }
  if (offer.status === "aceptada") return { error: "Este turno ya fue confirmado con esta propuesta." }
  if (shownVersion !== undefined && shownVersion !== offer.version)
    return {
      error: "Las condiciones cambiaron. Recargá la página y revisá el horario y el importe antes de confirmar.",
    }
  const slots = (offer.slots ?? []).filter((slot) => Number.isFinite(new Date(slot.start).getTime()))
  const selected = chosenSlot
    ? slots.find((slot) => new Date(slot.start).getTime() === new Date(chosenSlot).getTime())
    : slots.length === 1
      ? slots[0]
      : null
  if (!selected) return { error: "Elegí el horario que aceptó el cliente entre las opciones guardadas." }
  return { token: offer.token, version: offer.version, start: selected.start }
}
