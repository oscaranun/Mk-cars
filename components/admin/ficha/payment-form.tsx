"use client"

import { useState } from "react"
import { registerPayment } from "@/app/admin/(panel)/ficha-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass } from "@/components/admin/ui"
import { PAYMENT_METHOD } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export function PaymentForm({ appointmentId, balance }: { appointmentId: string; balance: string }) {
  const [mode, setMode] = useState<"total" | "parcial">("total")

  return (
    <ActionForm action={registerPayment} submitLabel={mode === "total" ? `Registrar pago total (${balance})` : "Registrar pago parcial"} resetOnSuccess>
      <input type="hidden" name="appointment_id" value={appointmentId} />
      <input type="hidden" name="mode" value={mode} />
      <div role="radiogroup" aria-label="Tipo de pago" className="grid grid-cols-2 gap-2">
        {(["total", "parcial"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "min-h-11 rounded-xl border px-3 text-sm font-medium transition",
              mode === m
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                : "border-border bg-card text-muted-foreground hover:border-electric/50",
            )}
          >
            {m === "total" ? "Pago total" : "Pago parcial"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {mode === "parcial" && (
          <Field label="Importe ($)" htmlFor="pay-amount">
            <input id="pay-amount" name="amount" inputMode="numeric" required className={fieldClass} placeholder="10000" />
          </Field>
        )}
        <Field label="Medio" htmlFor="pay-method" className={mode === "total" ? "col-span-2" : undefined}>
          <select id="pay-method" name="method" defaultValue="transferencia" className={fieldClass}>
            {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </ActionForm>
  )
}
