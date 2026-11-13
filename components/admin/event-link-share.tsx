"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react"
import { secondaryButtonClass } from "@/components/admin/ui"

export function EventLinkShare({ link, message }: { link: string; message: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <p className="break-all rounded-2xl bg-surface px-4 py-3 font-mono text-xs">{link}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${message}\n${link}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={secondaryButtonClass}
        >
          <MessageCircle className="size-4 text-emerald-400" aria-hidden="true" />
          Compartir por WhatsApp
        </a>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link).catch(() => null)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className={secondaryButtonClass}
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
        <a href={link.replace(/^https?:\/\/[^/]+/, "")} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
          <ExternalLink className="size-4" aria-hidden="true" />
          Ver flyer
        </a>
      </div>
    </div>
  )
}
