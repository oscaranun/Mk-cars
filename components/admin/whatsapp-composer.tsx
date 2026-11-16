"use client"

import { useId, useState } from "react"
import { Check, Copy, MessageCircle } from "lucide-react"
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui"
import { WhatsappAction } from "@/components/admin/whatsapp-action"

type Props = { phone: string; initialMessage: string; label: string; rows?: number; onOpen?: () => void }

/** Opens WhatsApp with an editable draft. Opening the chat never counts as sent. */
export function WhatsappComposer({ phone, initialMessage, label, rows = 12, onOpen }: Props) {
  const [message, setMessage] = useState(initialMessage)
  const [copied, setCopied] = useState(false)
  const id = useId()
  const hasPhone = Boolean(phone.replace(/\D/g, ""))
  const empty = !message.trim()

  async function copyMessage() {
    const ok = await navigator.clipboard
      .writeText(message.trim())
      .then(() => true)
      .catch(() => false)
    if (!ok) return
    onOpen?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        <button
          type="button"
          onClick={copyMessage}
          disabled={empty}
          className={`${hasPhone ? secondaryButtonClass : primaryButtonClass} w-full sm:w-fit disabled:opacity-60`}
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Mensaje copiado" : "Copiar mensaje"}</span>
        </button>
        <WhatsappAction
          phone={hasPhone ? phone : null}
          message={message}
          disabled={empty}
          onOpen={onOpen}
          showCopy={false}
          className={`${hasPhone ? primaryButtonClass : secondaryButtonClass} w-full sm:w-fit ${empty ? "pointer-events-none opacity-60" : ""}`}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          {hasPhone ? label : "Abrir WhatsApp y elegir contacto"}
        </WhatsappAction>
      </div>
      <p className="text-xs text-muted-foreground text-pretty">
        {hasPhone
          ? "Se abre WhatsApp con el mensaje listo, pero no se envía solo."
          : "El cliente no tiene teléfono cargado: copiá el mensaje y pegalo en su chat, o abrí WhatsApp y elegí el contacto."}
      </p>
    </div>
  )
}
