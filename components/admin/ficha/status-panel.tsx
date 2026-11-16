"use client"

import { useState } from "react"
import { setTurnoStatus } from "@/app/admin/(panel)/ficha-actions"
import type { ActionState } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass } from "@/components/admin/ui"
import { WhatsappComposer } from "@/components/admin/whatsapp-composer"
import { buildStatusMessage, type StatusMessageData } from "@/lib/admin/whatsapp-messages"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "confirmado", label: "Confirmado", tone: "border-primary/50 bg-primary/15 text-electric" },
  { value: "reprogramado", label: "Reprogramado", tone: "border-amber-300/50 bg-amber-400/15 text-amber-200" },
  { value: "realizado", label: "Realizado", tone: "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" },
  { value: "cancelado", label: "Cancelado", tone: "border-red-400/50 bg-red-500/15 text-red-200" },
  { value: "solicitado", label: "Solicitado", tone: "border-border bg-surface text-foreground" },
]

type MessageBase = Omit<StatusMessageData, "date" | "time">
type Props = {
  appointmentId: string
  current: string
  phone: string
  start: { date: string; time: string } | null
  messageBase: MessageBase
}

type Draft = { key: number; kind: "confirmado" | "reprogramado"; text: string }

export function StatusPanel({ appointmentId, current, phone, start, messageBase }: Props) {
  const [status, setStatus] = useState(current === "esperando_cliente" ? "solicitado" : current)
  const [draft, setDraft] = useState<Draft | null>(null)

  async function submit(prev: ActionState, data: FormData): Promise<ActionState> {
    const result = await setTurnoStatus(prev, data)
    const kind = String(data.get("status"))
    if (!result.ok || (kind !== "confirmado" && kind !== "reprogramado")) {
      setDraft(null)
      return result
    }
    const when =
      kind === "reprogramado" ? { date: String(data.get("date")), time: String(data.get("time")) } : start
    if (when) {
      setDraft({ key: Date.now(), kind, text: buildStatusMessage(kind, { ...messageBase, ...when }) })
    }
    return result
  }

  return (
    <div className="flex flex-col gap-4">
      <ActionForm action={submit} submitLabel="Guardar estado">
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

      {draft && (
        <section
          aria-label="Mensaje para el cliente"
          className="flex flex-col gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4"
        >
          <h3 className="text-sm font-semibold">
            {draft.kind === "confirmado" ? "Mensaje de confirmación" : "Mensaje de reprogramación"}
          </h3>
          {phone ? (
            <WhatsappComposer key={draft.key} phone={phone} initialMessage={draft.text} label="Enviar por WhatsApp" />
          ) : (
            <p className="text-sm text-muted-foreground">El cliente no tiene WhatsApp cargado.</p>
          )}
        </section>
      )}
    </div>
  )
}
