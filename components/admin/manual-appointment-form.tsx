import { createManualAppointment } from "@/app/admin/(panel)/offer-actions"
import { ActionForm } from "@/components/admin/action-form"
import { vehicleOptionLabel } from "@/components/admin/appointment-vehicle-tools"
import { Field, SectionTitle, fieldClass } from "@/components/admin/ui"
import { formatWhatsapp } from "@/lib/admin/format"
import { WHATSAPP_DEFAULT_PREFIX } from "@/lib/booking"
import { VehicleDurationFields } from "@/components/admin/vehicle-duration-fields"

const SOURCES: [string, string][] = [
  ["whatsapp", "WhatsApp"],
  ["telefono", "Teléfono"],
  ["instagram", "Instagram"],
  ["presencial", "Presencial"],
  ["otro", "Otro"],
]
export type ManualClient = {
  id: string
  full_name: string
  whatsapp: string
  vehicles: { id: string; category: string; brand: string | null; model: string | null; plate: string | null }[]
}
export function ManualAppointmentForm({
  client = null,
  fromAppointment = null,
  defaults = { auto: 60, suv: 75, pickup: 90 },
  returnToClient = false,
  idPrefix = "manual",
}: {
  client?: ManualClient | null
  fromAppointment?: {
    address: string
    neighborhood: string | null
    water_supply: string
    vehicle_id: string | null
  } | null
  defaults?: Record<string, number>
  returnToClient?: boolean
  idPrefix?: string
}) {
  const vehicles = client?.vehicles ?? []
  const suggestedVehicle = vehicles.find((v) => v.id !== fromAppointment?.vehicle_id)?.id ?? ""
  return (
    <ActionForm action={createManualAppointment} submitLabel="Crear turno">
      {returnToClient && client && <input type="hidden" name="return_client_id" value={client.id} />}
      <SectionTitle>Cliente</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre y apellido" htmlFor={`${idPrefix}-full_name`}>
          <input
            id={`${idPrefix}-full_name`}
            name="full_name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={client?.full_name ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="WhatsApp" htmlFor={`${idPrefix}-whatsapp`}>
          <input
            id={`${idPrefix}-whatsapp`}
            name="whatsapp"
            type="tel"
            inputMode="tel"
            required
            placeholder="+54 9 261 555 1234"
            defaultValue={client ? formatWhatsapp(client.whatsapp) : WHATSAPP_DEFAULT_PREFIX}
            readOnly={Boolean(client)}
            className={fieldClass}
          />
        </Field>
        <Field label="Origen del pedido" htmlFor={`${idPrefix}-source`}>
          <select id={`${idPrefix}-source`} name="source" required defaultValue="whatsapp" className={fieldClass}>
            {SOURCES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SectionTitle>Vehículo y servicio</SectionTitle>
      {vehicles.length > 0 && (
        <Field label="Vehículo del cliente" htmlFor={`${idPrefix}-vehicle_id`}>
          <select
            id={`${idPrefix}-vehicle_id`}
            name="vehicle_id"
            defaultValue={suggestedVehicle}
            className={fieldClass}
          >
            <option value="">Uno nuevo (completar marca y modelo)</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {vehicleOptionLabel(v)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <VehicleDurationFields defaults={defaults} idPrefix={idPrefix} />
        <Field label={vehicles.length ? "Marca (si es nuevo)" : "Marca"} htmlFor={`${idPrefix}-brand`}>
          <input id={`${idPrefix}-brand`} name="brand" maxLength={60} className={fieldClass} />
        </Field>
        <Field label={vehicles.length ? "Modelo (si es nuevo)" : "Modelo"} htmlFor={`${idPrefix}-model`}>
          <input id={`${idPrefix}-model`} name="model" maxLength={60} className={fieldClass} />
        </Field>
        <Field label="Servicio" htmlFor={`${idPrefix}-service`}>
          <input
            id={`${idPrefix}-service`}
            name="service"
            maxLength={200}
            placeholder="Lavado completo"
            className={fieldClass}
          />
        </Field>
        <Field label="Precio acordado (opcional)" htmlFor={`${idPrefix}-price`}>
          <input
            id={`${idPrefix}-price`}
            name="price"
            type="number"
            min={0}
            max={10_000_000}
            step={100}
            className={`${fieldClass} tabular-nums`}
          />
        </Field>
      </div>

      <SectionTitle>Domicilio</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dirección" htmlFor={`${idPrefix}-address`}>
          <input
            id={`${idPrefix}-address`}
            name="address"
            required
            maxLength={200}
            defaultValue={fromAppointment?.address ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="Barrio" htmlFor={`${idPrefix}-neighborhood`}>
          <input
            id={`${idPrefix}-neighborhood`}
            name="neighborhood"
            maxLength={120}
            defaultValue={fromAppointment?.neighborhood ?? ""}
            className={fieldClass}
          />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="no_water"
          defaultChecked={fromAppointment?.water_supply === "propia"}
          className="size-4 accent-primary"
        />
        No hay canilla disponible: llevamos agua propia
      </label>

      <Field label="Comentarios del cliente" htmlFor={`${idPrefix}-client_notes`}>
        <textarea
          id={`${idPrefix}-client_notes`}
          name="client_notes"
          rows={3}
          maxLength={1000}
          className={fieldClass}
        />
      </Field>
      <Field label="Nota interna (no la ve el cliente)" htmlFor={`${idPrefix}-internal_note`}>
        <textarea
          id={`${idPrefix}-internal_note`}
          name="internal_note"
          rows={3}
          maxLength={4000}
          className={fieldClass}
        />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="ignore_duplicate"
          defaultChecked={Boolean(client)}
          className="size-4 accent-[var(--primary)]"
        />
        Crear igual aunque el cliente ya tenga un turno activo
      </label>
    </ActionForm>
  )
}
