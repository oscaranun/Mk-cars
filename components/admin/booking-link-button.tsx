"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { SITE_URL } from "@/lib/seo"

const BOOKING_LINK = `${SITE_URL}/reservar`

export function BookingLinkButton() {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(BOOKING_LINK).catch(() => null)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      title={`Copiar ${BOOKING_LINK} para pegar en WhatsApp`}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 active:scale-[0.98]"
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? "¡Link copiado!" : "Solicitar turno"}</span>
      <span className="sr-only"> — copia el link de reserva para enviar por WhatsApp</span>
    </button>
  )
}
