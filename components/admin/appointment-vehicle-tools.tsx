import Link from "next/link"
import { CalendarPlus } from "lucide-react"
import { addVehicleToAppointment } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { VEHICLE_CATEGORY } from "@/lib/admin/labels"

type ClientVehicle = { id: string; category: string; brand: string | null; model: string | null; plate: string | null }

export function vehicleOptionLabel(v: ClientVehicle) {
  const name = [v.brand, v.model].filter(Boolean).join(" ") || "Sin marca/modelo"
  return `${name} · ${VEHICLE_CATEGORY[v.category] ?? v.category}${v.plate ? ` · ${v.plate}` : ""}`
}

export function AppointmentVehicleTools({
  appointmentId,
  clientId,
  canEdit,
  availableVehicles,
}: {
  appointmentId: string
  clientId: string
  canEdit: boolean
  availableVehicles: ClientVehicle[]
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      {canEdit && (
        <details className="rounded-2xl border border-border px-4 py-2 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">Agregar otro vehículo a este turno</summary>
          <p className="pb-3 text-xs text-muted-foreground text-pretty">
            Se lava en el mismo horario y domicilio. Suma su precio de lista y su duración al turno.
          </p>
          <ActionForm action={addVehicleToAppointment} submitLabel="Agregar al turno" resetOnSuccess className="pb-3">
            <input type="hidden" name="appointment_id" value={appointmentId} />
            {availableVehicles.length > 0 && (
              <Field label="Vehículo del cliente" htmlFor="add-vehicle-id">
                <select id="add-vehicle-id" name="vehicle_id" defaultValue="" className={fieldClass}>
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
                <Field label="Tipo" htmlFor="add-vehicle-category">
                  <select id="add-vehicle-category" name="category" defaultValue="auto" className={fieldClass}>
                    {Object.entries(VEHICLE_CATEGORY).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Marca" htmlFor="add-vehicle-brand">
                  <input id="add-vehicle-brand" name="brand" maxLength={60} className={fieldClass} />
                </Field>
                <Field label="Modelo" htmlFor="add-vehicle-model">
                  <input id="add-vehicle-model" name="model" maxLength={60} className={fieldClass} />
                </Field>
              </div>
            </fieldset>
          </ActionForm>
        </details>
      )}
      <Link href={`/admin/turnos/nuevo?cliente=${clientId}&desde=${appointmentId}`} className={`${secondaryButtonClass} w-full sm:w-fit`}>
        <CalendarPlus className="size-4" aria-hidden="true" />
        Nuevo turno para este cliente (otro horario)
      </Link>
    </div>
  )
}
