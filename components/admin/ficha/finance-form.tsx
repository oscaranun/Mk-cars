"use client"

import { useState } from "react"
import { addFinanceEntry } from "@/app/admin/(panel)/pruebas/actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass } from "@/components/admin/ui"
import { PAYMENT_METHOD } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

type Concept = { id: string; kind: "ingreso" | "gasto"; name: string }

export function FinanceForm({ concepts, today }: { concepts: Concept[]; today: string }) {
  const [kind, setKind] = useState<"gasto" | "ingreso">("gasto")
  const [concept, setConcept] = useState("")
  const options = concepts.filter((c) => c.kind === kind)

  return (
    <ActionForm action={addFinanceEntry} submitLabel={kind === "gasto" ? "Cargar gasto" : "Cargar ingreso"} resetOnSuccess>
      <input type="hidden" name="kind" value={kind} />
      <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
        {(["gasto", "ingreso"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => {
              setKind(k)
              setConcept("")
            }}
            className={cn(
              "min-h-11 rounded-xl border px-3 text-sm font-medium transition",
              kind === k
                ? k === "gasto"
                  ? "border-red-400/50 bg-red-500/15 text-red-200"
                  : "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                : "border-border bg-card text-muted-foreground hover:border-electric/50",
            )}
          >
            {k === "gasto" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Concepto" htmlFor="f-concept">
          <select
            id="f-concept"
            name="concept"
            required
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className={fieldClass}
          >
            <option value="" disabled>
              Elegí…
            </option>
            {options.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            <option value="__nuevo">Otro (escribir)…</option>
          </select>
        </Field>
        <Field label="Importe ($)" htmlFor="f-amount">
          <input id="f-amount" name="amount" inputMode="numeric" required className={fieldClass} placeholder="15000" />
        </Field>

        {concept === "__nuevo" && (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Field label="¿Qué es?" htmlFor="f-new">
              <input id="f-new" name="new_concept" required className={fieldClass} placeholder="Ej: Seguro de la camioneta" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="save_preset" className="size-4 accent-[var(--color-primary)]" />
              Guardarlo como predeterminado para la próxima
            </label>
          </div>
        )}

        <Field label="Medio" htmlFor="f-method">
          <select id="f-method" name="method" defaultValue="efectivo" className={fieldClass}>
            {Object.entries(PAYMENT_METHOD).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha" htmlFor="f-date">
          <input id="f-date" name="date" type="date" defaultValue={today} max={today} className={fieldClass} />
        </Field>
        <Field label="Detalle (opcional)" htmlFor="f-notes" className="sm:col-span-2">
          <input id="f-notes" name="notes" className={fieldClass} />
        </Field>
      </div>
    </ActionForm>
  )
}
