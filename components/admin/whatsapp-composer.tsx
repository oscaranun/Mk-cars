"use client"

import { useId, useState } from "react"
import { MessageCircle } from "lucide-react"
import { fieldClass, primaryButtonClass } from "@/components/admin/ui"

type Props = { phone: string; initialMessage: string; label: string }

/** Opens wa.me with an editable draft. Opening the chat never counts as sent. */
export function WhatsappComposer({ phone, initialMessage, label }: Props) {
  const [message, setMessage] = useState(initialMessage)
  const id = useId()
  const digits = phone.replace(/\D/g, "")
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message.trim())}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          Mensaje (podés editarlo antes de enviarlo)
        </label>
        <textarea
          id={id}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={12}
          className={`${fieldClass} py-2.5 text-base leading-relaxed md:text-sm`}
        />
      </div>
      <a
        href={digits ? href : undefined}
        aria-disabled={!digits || !message.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className={`${primaryButtonClass} w-full sm:w-fit ${!digits || !message.trim() ? "pointer-events-none opacity-60" : ""}`}
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {label}
      </a>
      <p className="text-xs text-muted-foreground text-pretty">
        Se abre WhatsApp con el mensaje listo, pero no se envía solo. El CRM no lo registra hasta que toques {'"Marcar como enviado"'}.
      </p>
    </div>
  )
}
