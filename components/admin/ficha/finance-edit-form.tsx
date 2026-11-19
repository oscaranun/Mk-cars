import { updateFinanceEntry } from "@/app/admin/(panel)/ficha-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass } from "@/components/admin/ui"
import type { FinanceConcept } from "@/components/admin/ficha/finance-form"

type Entry = {
  id: string
  type: "ingreso" | "gasto"
  concept: string
  subconcept: string | null
  amount: number
  day: string
  notes: string | null
}

function withCurrent(names: string[], current: string | null) {
  return current && !names.includes(current) ? [current, ...names] : names
}

export function FinanceEditForm({ entry, concepts, today }: { entry: Entry; concepts: FinanceConcept[]; today: string }) {
  const id = entry.id.slice(0, 8)
  const conceptNames = withCurrent(
    concepts.filter((c) => c.kind === entry.type).map((c) => c.name),
    entry.concept,
  )
  const subNames = withCurrent(
    concepts.filter((c) => c.kind === "subconcepto").map((c) => c.name),
    entry.subconcept,
  )

  return (
    <ActionForm action={updateFinanceEntry} submitLabel="Guardar cambios">
      <input type="hidden" name="id" value={entry.id} />
      <input type="hidden" name="kind" value={entry.type} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Concepto" htmlFor={`e-c-${id}`}>
          <select id={`e-c-${id}`} name="concept" required defaultValue={entry.concept} className={fieldClass}>
            {conceptNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subconcepto" htmlFor={`e-s-${id}`}>
          <select id={`e-s-${id}`} name="subconcept" required defaultValue={entry.subconcept ?? ""} className={fieldClass}>
            <option value="" disabled>
              Elegí…
            </option>
            {subNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Importe ($)" htmlFor={`e-a-${id}`}>
          <input id={`e-a-${id}`} name="amount" inputMode="numeric" required defaultValue={entry.amount} className={fieldClass} />
        </Field>
        <Field label="Fecha" htmlFor={`e-d-${id}`}>
          <input id={`e-d-${id}`} name="date" type="date" required defaultValue={entry.day} max={today} className={fieldClass} />
        </Field>
        <Field label="Detalle" htmlFor={`e-n-${id}`} className="sm:col-span-2">
          <input id={`e-n-${id}`} name="notes" defaultValue={entry.notes ?? ""} className={fieldClass} />
        </Field>
      </div>
    </ActionForm>
  )
}
