"use client"

import { useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react"
import { Check, Copy } from "lucide-react"
import { secondaryButtonClass } from "@/components/admin/ui"
import { waMeUrl, whatsappWebUrl } from "@/lib/whatsapp"

function isMobileDevice() {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  if (nav.userAgentData?.mobile) return true
  if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(nav.userAgent)) return true
  // iPadOS reports a desktop Safari user agent.
  return /Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1
}

const noopSubscribe = () => () => {}

function useIsDesktop() {
  return useSyncExternalStore(noopSubscribe, () => !isMobileDevice(), () => false)
}

/**
 * Single entry point for opening WhatsApp from the panel.
 * Phones follow the wa.me link; PCs open WhatsApp Web directly in one new tab.
 * WhatsApp Web's Cross-Origin-Opener-Policy clears the tab name, so Chrome cannot
 * reuse one named tab across contacts; "Copiar mensaje" covers the already-open tab.
 * Nothing is sent automatically: the operator always presses send in WhatsApp.
 */
export function openWhatsapp(phone: string | null | undefined, message?: string) {
  if (isMobileDevice()) {
    window.location.href = waMeUrl(phone, message)
    return
  }
  window.open(whatsappWebUrl(phone, message), "_blank", "noopener,noreferrer")
}

type Props = {
  phone?: string | null
  message?: string
  className?: string
  copyClassName?: string
  showCopy?: boolean
  disabled?: boolean
  onOpen?: () => void
  children: ReactNode
}

export function WhatsappAction({
  phone,
  message,
  className,
  copyClassName = secondaryButtonClass,
  showCopy = true,
  disabled = false,
  onOpen,
  children,
}: Props) {
  const isDesktop = useIsDesktop()
  const [copied, setCopied] = useState(false)
  const text = message?.trim() ?? ""

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (disabled) {
      event.preventDefault()
      return
    }
    onOpen?.()
    if (!isMobileDevice()) {
      event.preventDefault()
      openWhatsapp(phone, text)
    }
  }

  async function copyMessage() {
    const ok = await navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false)
    if (!ok) return
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <a
        href={disabled ? undefined : waMeUrl(phone, text)}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={disabled || undefined}
        onClick={handleClick}
        className={className}
      >
        {children}
      </a>
      {isDesktop && showCopy && text && (
        <button
          type="button"
          onClick={copyMessage}
          disabled={disabled}
          title="Para pegarlo en el WhatsApp Web que ya tenés abierto"
          className={copyClassName}
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Mensaje copiado" : "Copiar mensaje"}</span>
        </button>
      )}
    </>
  )
}
