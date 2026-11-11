"use client"

import { useState } from "react"
import { Field, fieldClass } from "@/components/admin/ui"
import { VEHICLE_CATEGORY } from "@/lib/admin/labels"

const PRESETS = [30, 45, 60, 90, 120]
const CATEGORIES = ["auto", "suv", "pickup"] as const

export function VehicleDurationFields({ defaults, idPrefix = "vehicle" }: { defaults: Record<string, number>; idPrefix?: string }) {
  const [category, setCategory] = useState<string>("auto")
  const [choice, setChoice] = useState<string>("auto")
  const [custom, setCustom] = useState("")
  const suggested = defaults[category] ?? 60
  const minutes = choice === "auto" ? suggested : choice === "custom" ? Number(custom) || "" : Number(choice)

  return (
    <>
      <Field label="Tipo de vehículo" htmlFor={`${idPrefix}-vehicle_category`}>
        <select
          id={`${idPrefix}-vehicle_category`}
          name="vehicle_category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={fieldClass}
        >
          {CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {VEHICLE_CATEGORY[key] ?? key}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Duración estimada del lavado" htmlFor={`${idPrefix}-duration_choice`}>
        <select id={`${idPrefix}-duration_choice`} value={choice} onChange={(e) => setChoice(e.target.value)} className={fieldClass}>
          <option value="auto">Sugerida: {suggested} min</option>
          {PRESETS.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
          <option value="custom">Otro tiempo…</option>
        </select>
      </Field>
      {choice === "custom" && (
        <Field label="Minutos personalizados" htmlFor={`${idPrefix}-duration_custom`}>
          <input
            id={`${idPrefix}-duration_custom`}
            type="number"
            inputMode="numeric"
            min={15}
            max={540}
            step={5}
            required
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className={`${fieldClass} tabular-nums`}
          />
        </Field>
      )}
      <input type="hidden" name="duration" value={minutes} />
    </>
  )
}
