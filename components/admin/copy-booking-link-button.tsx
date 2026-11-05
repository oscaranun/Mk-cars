"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Link2 } from "lucide-react"
import { secondaryButtonClass } from "@/components/admin/ui"

const BOOKING_URL = "https://www.mkcars.com.ar/reservar"

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand("copy")
  document.body.removeChild(textarea)
  if (!ok) throw new Error("copy failed")
}

export function CopyBookingLinkButton() {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  async function handleClick() {
    try {
      await copyText(BOOKING_URL)
      setStatus("copied")
    } catch {
      setStatus("error")
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setStatus("idle"), 2500)
  }

  return (
    <>
      <button type="button" onClick={handleClick} className={secondaryButtonClass}>
        {status === "copied" ? (
          <Check className="size-4 text-emerald-400" aria-hidden="true" />
        ) : (
          <Link2 className="size-4" aria-hidden="true" />
        )}
        Solicitar Formulario Turno
      </button>
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center transition-all duration-200 sm:inset-x-auto sm:right-6 sm:bottom-6 ${
          status === "idle" ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {status !== "idle" && (
          <p className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground shadow-lg">
            {status === "copied" ? "Enlace de reserva copiado" : "No se pudo copiar el enlace"}
          </p>
        )}
      </div>
    </>
  )
}
