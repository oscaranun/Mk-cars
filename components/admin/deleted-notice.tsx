"use client"

import { useEffect } from "react"
import { CheckCircle2 } from "lucide-react"

export function DeletedNotice() {
  useEffect(() => {
    // Strip the flag without a navigation so a reload doesn't show the notice again.
    const url = new URL(window.location.href)
    url.searchParams.delete("eliminada")
    window.history.replaceState(window.history.state, "", url)
  }, [])

  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      Reserva eliminada correctamente
    </p>
  )
}
