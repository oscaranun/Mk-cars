"use client"

import { useState } from "react"
import { setTurnoStatus } from "@/app/admin/(panel)/pruebas/actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass } from "@/components/admin/ui"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "confirmado", label: "Confirmado", tone: "border-primary/50 bg-primary/15 text-electric" },
  { value: "reprogramado", label: "Reprogramado", tone: "border-amber-300/50 bg-amber-400/15 text-amber-200" },
  { value: "realizado", label: "Realizado", tone: "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" },
  { value: "cancelado", label: "Cancelado", tone: "border-red-400/50 bg-red-500/15 text-red-200" },
  { value: "solicitado", label: "Solicitado", tone: "border-border bg-surface text-foreground" },
]

export function StatusPanel({ appointmentId, current }: { appointmentId: string; current: string }) {
  const [status, setStatus] = useState(current === "esperando_cliente" ? "solicitado" : current)

  return (
    <ActionForm action={setTurnoStatus} submitLabel="Guardar estado">
      <input type="hidden" name="appointment_id" value={appointmentId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Estado del turno</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const active = status === o.value
            return (
              <label
                key={o.value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-medium transition",
                  active ? o.tone : "border-border bg-card text-muted-foreground hover:border-electric/50",
                )}
              >
                <input
                  type="radio"
                  name="status"
                  value={o.value}
                  checked={active}
                  onChange={() => setStatus(o.value)}
                  className="sr-only"
                />
                {o.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      {status === "reprogramado" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nueva fecha" htmlFor="st-date">
            <input id="st-date" name="date" type="date" required className={fieldClass} />
          </Field>
          <Field label="Nueva hora" htmlFor="st-time">
            <input id="st-time" name="time" type="time" required className={fieldClass} />
          </Field>
        </div>
      )}
      {status === "cancelado" && (
        <Field label="Motivo (opcional)" htmlFor="st-reason">
          <input id="st-reason" name="reason" className={fieldClass} placeholder="Ej: el cliente no puede ese día" />
        </Field>
      )}
    </ActionForm>
  )
}
