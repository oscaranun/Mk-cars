"use client"

import { useState } from "react"
import { Field, fieldClass } from "@/components/admin/ui"
import { PANEL_VEHICLE_CATEGORY } from "@/lib/admin/labels"

const OTHER_SUGGESTIONS = ["Moto", "Cuatriciclo", "Lancha", "Moto de agua", "Casa rodante", "Utilitario"]

type Props = {
  idPrefix: string
  category?: string
  categoryLabel?: string | null
  brand?: string | null
  model?: string | null
  price?: number | null
}

export function VehicleFields({ idPrefix, category = "auto", categoryLabel, brand, model, price }: Props) {
  const [type, setType] = useState(category)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field label="Tipo" htmlFor={`${idPrefix}-cat`}>
        <select
          id={`${idPrefix}-cat`}
          name="category"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={fieldClass}
        >
          {Object.entries(PANEL_VEHICLE_CATEGORY).map(([value, label]) => (
            <option key={value} value={value}>
              {value === "otro" ? "Otro (moto, cuatri…)" : label}
            </option>
          ))}
        </select>
      </Field>
      {type === "otro" ? (
        <Field label="¿Qué vehículo?" htmlFor={`${idPrefix}-label`}>
          <input
            id={`${idPrefix}-label`}
            name="category_label"
            list={`${idPrefix}-suggestions`}
            defaultValue={categoryLabel ?? ""}
            required
            className={fieldClass}
            placeholder="Moto"
          />
          <datalist id={`${idPrefix}-suggestions`}>
            {OTHER_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
      ) : (
        <Field label="Marca" htmlFor={`${idPrefix}-brand`}>
          <input id={`${idPrefix}-brand`} name="brand" defaultValue={brand ?? ""} className={fieldClass} placeholder="Toyota" />
        </Field>
      )}
      <Field label="Modelo" htmlFor={`${idPrefix}-model`}>
        <input id={`${idPrefix}-model`} name="model" defaultValue={model ?? ""} className={fieldClass} placeholder="Hilux" />
      </Field>
      <Field label="Precio ($)" htmlFor={`${idPrefix}-price`}>
        <input
          id={`${idPrefix}-price`}
          name="price"
          inputMode="numeric"
          defaultValue={price ?? ""}
          className={fieldClass}
          placeholder="30000"
        />
      </Field>
      {type === "otro" && <input type="hidden" name="brand" value={brand ?? ""} />}
    </div>
  )
}
