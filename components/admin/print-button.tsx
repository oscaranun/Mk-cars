"use client"

import { Printer } from "lucide-react"
import { primaryButtonClass } from "@/components/admin/ui"

export function PrintButton({ label = "Descargar PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={primaryButtonClass}>
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}
