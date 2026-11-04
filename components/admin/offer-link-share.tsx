"use client"

import { useState } from "react"
import { Check, Copy, MessageCircle } from "lucide-react"
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui"

export function OfferLinkShare({ link, phone, message }: { link: string; phone: string; message: string }) {
  const [copied, setCopied] = useState(false)
  const digits = phone.replace(/\D/g, "")

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Enlace del cliente (siempre el mismo)</p>
      <p className="break-all rounded-2xl bg-surface px-4 py-3 font-mono text-xs">{link}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${primaryButtonClass} w-full sm:w-fit`}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Enviar enlace por WhatsApp
        </a>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link).catch(() => null)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className={`${secondaryButtonClass} w-full sm:w-fit`}
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar enlace"}
        </button>
      </div>
    </div>
  )
}
