"use client"

import { useId, useState } from "react"
import { MessageCircle } from "lucide-react"
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui"
import { WhatsappAction } from "@/components/admin/whatsapp-action"

type Props = { phone: string; initialMessage: string; label: string; rows?: number; onOpen?: () => void }

/** Opens WhatsApp with an editable draft. Opening the chat never counts as sent. */
export function WhatsappComposer({ phone, initialMessage, label, rows = 12, onOpen }: Props) {
  const [message, setMessage] = useState(initialMessage)
  const id = useId()
  const disabled = !phone.replace(/\D/g, "") || !message.trim()

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
          rows={rows}
          className={`${fieldClass} py-2.5 text-base leading-relaxed md:text-sm`}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <WhatsappAction
          phone={phone}
          message={message}
          disabled={disabled}
          onOpen={onOpen}
          className={`${primaryButtonClass} w-full sm:w-fit ${disabled ? "pointer-events-none opacity-60" : ""}`}
          copyClassName={`${secondaryButtonClass} w-full sm:w-fit`}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {label}
        </WhatsappAction>
      </div>
      <p className="text-xs text-muted-foreground text-pretty">
        Se abre WhatsApp con el mensaje listo, pero no se envía solo. El CRM no lo registra hasta que toques {'"Marcar como enviado"'}.
      </p>
    </div>
  )
}
