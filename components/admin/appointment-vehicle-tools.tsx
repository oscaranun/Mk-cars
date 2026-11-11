import Link from "next/link"
import { CalendarPlus } from "lucide-react"
import { addVehicleToAppointment } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { PANEL_VEHICLE_CATEGORY, vehicleCategoryLabel } from "@/lib/admin/labels"

export type ClientVehicle = {
  id: string
  category: string
  category_label?: string | null
  brand: string | null
  model: string | null
  plate: string | null
}

export function vehicleOptionLabel(v: ClientVehicle) {
  const name = [v.brand, v.model].filter(Boolean).join(" ") || "Sin marca/modelo"
  return `${name} · ${vehicleCategoryLabel(v.category, v.category_label)}${v.plate ? ` · ${v.plate}` : ""}`
}

export function AppointmentVehicleTools({
  appointmentId,
  clientId,
  canEdit,
  availableVehicles,
  showNewTurnLink = true,
  idPrefix = "add-vehicle",
}: {
  appointmentId: string
  clientId: string
  canEdit: boolean
  availableVehicles: ClientVehicle[]
  showNewTurnLink?: boolean
  idPrefix?: string
}) {
  return (
    <div className={showNewTurnLink ? "flex flex-col gap-3 border-t border-border pt-4" : "flex flex-col gap-3"}>
      {canEdit && (
        <details className="rounded-2xl border border-border px-4 py-2 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">Agregar otro vehículo a este turno</summary>
          <p className="pb-3 text-xs text-muted-foreground text-pretty">
            Se lava en el mismo horario y domicilio. Su precio y su duración se suman al turno.
          </p>
          <ActionForm action={addVehicleToAppointment} submitLabel="Agregar al turno" resetOnSuccess className="pb-3">
            <input type="hidden" name="appointment_id" value={appointmentId} />
            {availableVehicles.length > 0 && (
              <Field label="Vehículo del cliente" htmlFor={`${idPrefix}-id`}>
                <select id={`${idPrefix}-id`} name="vehicle_id" defaultValue="" className={fieldClass}>
                  <option value="">Uno nuevo (completar abajo)</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {vehicleOptionLabel(v)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <fieldset className="flex flex-col gap-3">
              <legend className="pb-2 text-xs text-muted-foreground">
                {availableVehicles.length > 0 ? "Si es un vehículo nuevo" : "Datos del vehículo"}
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Tipo" htmlFor={`${idPrefix}-category`}>
                  <select id={`${idPrefix}-category`} name="category" defaultValue="auto" className={fieldClass}>
                    {Object.entries(PANEL_VEHICLE_CATEGORY).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Marca" htmlFor={`${idPrefix}-brand`}>
                  <input id={`${idPrefix}-brand`} name="brand" maxLength={60} className={fieldClass} />
                </Field>
                <Field label="Modelo" htmlFor={`${idPrefix}-model`}>
                  <input id={`${idPrefix}-model`} name="model" maxLength={60} className={fieldClass} />
                </Field>
              </div>
              <Field label="Si es Otro, ¿qué vehículo es?" htmlFor={`${idPrefix}-label`}>
                <input
                  id={`${idPrefix}-label`}
                  name="category_label"
                  maxLength={40}
                  placeholder="Moto, Cuatriciclo, Lancha…"
                  className={fieldClass}
                />
              </Field>
            </fieldset>
            <Field label="Precio de este vehículo" htmlFor={`${idPrefix}-price`}>
              <input
                id={`${idPrefix}-price`}
                name="price"
                inputMode="decimal"
                placeholder="Vacío = precio de lista (obligatorio para Otro)"
                className={fieldClass}
              />
            </Field>
          </ActionForm>
        </details>
      )}
      {showNewTurnLink && (
        <Link href={`/admin/turnos/nuevo?cliente=${clientId}&desde=${appointmentId}`} className={`${secondaryButtonClass} w-full sm:w-fit`}>
          <CalendarPlus className="size-4" aria-hidden="true" />
          Nuevo turno para este cliente (otro horario)
        </Link>
      )}
    </div>
  )
}
