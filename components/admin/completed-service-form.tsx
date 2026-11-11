import { randomUUID } from "node:crypto"
import { registerCompletedService } from "@/app/admin/(panel)/offer-actions"
import { ActionForm } from "@/components/admin/action-form"
import { vehicleOptionLabel } from "@/components/admin/appointment-vehicle-tools"
import { Field, SectionTitle, fieldClass } from "@/components/admin/ui"
import type { ManualClient } from "@/components/admin/manual-appointment-form"
import { WHATSAPP_DEFAULT_PREFIX } from "@/lib/booking"
import { todayArgentina, argentinaParts } from "@/lib/admin/format"
import { PANEL_VEHICLE_CATEGORY } from "@/lib/admin/labels"
const SOURCES: [string, string][] = [
  ["whatsapp", "WhatsApp"],
  ["telefono", "Teléfono"],
  ["instagram", "Instagram"],
  ["presencial", "Presencial"],
  ["otro", "Otro"],
]
const METHODS: [string, string][] = [
  ["efectivo", "Efectivo"],
  ["transferencia", "Transferencia"],
  ["mercadopago", "Mercado Pago"],
  ["otro", "Otro"],
]
export function CompletedServiceForm({
  client = null,
  address = "",
  idPrefix = "completed",
}: {
  client?: ManualClient | null
  address?: string
  idPrefix?: string
}) {
  return (
    <ActionForm action={registerCompletedService} submitLabel="Registrar lavado">
      <input type="hidden" name="request_id" value={randomUUID()} />
      {client && <input type="hidden" name="client_id" value={client.id} />}
      {client && <input type="hidden" name="return_client_id" value={client.id} />}
      <SectionTitle>Cliente</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre y apellido" htmlFor={`${idPrefix}-full_name`}>
          <input
            id={`${idPrefix}-full_name`}
            name="full_name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="off"
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
            defaultValue={client?.whatsapp ?? WHATSAPP_DEFAULT_PREFIX}
            readOnly={Boolean(client)}
            className={fieldClass}
          />
        </Field>
        <Field label="Origen" htmlFor={`${idPrefix}-source`}>
          <select id={`${idPrefix}-source`} name="source" required defaultValue="whatsapp" className={fieldClass}>
            {SOURCES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SectionTitle>Vehículo y lavado</SectionTitle>
      {client?.vehicles.length ? (
        <Field label="Vehículo guardado" htmlFor={`${idPrefix}-vehicle_id`}>
          <select
            id={`${idPrefix}-vehicle_id`}
            name="vehicle_id"
            defaultValue={client.vehicles[0]?.id ?? ""}
            className={fieldClass}
          >
            <option value="">Uno nuevo</option>
            {client.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {vehicleOptionLabel(v)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de vehículo" htmlFor={`${idPrefix}-vehicle_category`}>
          <select
            id={`${idPrefix}-vehicle_category`}
            name="vehicle_category"
            required
            defaultValue="auto"
            className={fieldClass}
          >
            {(["auto", "suv", "pickup", "otro"] as const).map((key) => (
              <option key={key} value={key}>
                {PANEL_VEHICLE_CATEGORY[key] ?? key}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Si es Otro, ¿cuál?" htmlFor={`${idPrefix}-category_label`}>
          <input id={`${idPrefix}-category_label`} name="category_label" maxLength={40} className={fieldClass} />
        </Field>
        <Field label="Marca" htmlFor={`${idPrefix}-brand`}>
          <input id={`${idPrefix}-brand`} name="brand" maxLength={60} className={fieldClass} />
        </Field>
        <Field label="Modelo" htmlFor={`${idPrefix}-model`}>
          <input id={`${idPrefix}-model`} name="model" maxLength={60} className={fieldClass} />
        </Field>
        <Field label="Tipo de lavado" htmlFor={`${idPrefix}-service`}>
          <input
            id={`${idPrefix}-service`}
            name="service"
            required
            minLength={2}
            maxLength={120}
            defaultValue="Lavado completo"
            className={fieldClass}
          />
        </Field>
        <Field label="Fecha" htmlFor={`${idPrefix}-date`}>
          <input
            id={`${idPrefix}-date`}
            name="date"
            type="date"
            required
            max={todayArgentina()}
            defaultValue={todayArgentina()}
            className={fieldClass}
          />
        </Field>
        <Field label="Hora real del lavado" htmlFor={`${idPrefix}-time`}>
          <input
            id={`${idPrefix}-time`}
            name="time"
            type="time"
            required
            step={60}
            defaultValue={argentinaParts(new Date()).time}
            className={fieldClass}
          />
        </Field>
        <Field label="Operador (opcional)" htmlFor={`${idPrefix}-operator`}>
          <input id={`${idPrefix}-operator`} name="operator" maxLength={80} className={fieldClass} />
        </Field>
      </div>

      <SectionTitle>Domicilio</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dirección" htmlFor={`${idPrefix}-address`}>
          <input
            id={`${idPrefix}-address`}
            name="address"
            required
            minLength={5}
            maxLength={200}
            defaultValue={address}
            className={fieldClass}
          />
        </Field>
        <Field label="Barrio" htmlFor={`${idPrefix}-neighborhood`}>
          <input id={`${idPrefix}-neighborhood`} name="neighborhood" maxLength={120} className={fieldClass} />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="no_water" className="size-5 accent-primary" />
        Llevamos agua propia
      </label>

      <SectionTitle>Cobro</SectionTitle>
      <p className="text-sm text-muted-foreground">
        La fecha del lavado y la del cobro pueden ser distintas. Usá la fecha real de la transferencia para conciliar
        con el banco. La fecha de carga se registra automáticamente.
      </p>
      <Field label="Fecha y hora real del cobro" htmlFor={`${idPrefix}-paid_at`}>
        <input
          id={`${idPrefix}-paid_at`}
          name="paid_at"
          type="datetime-local"
          defaultValue={`${todayArgentina()}T${argentinaParts(new Date()).time}`}
          className={fieldClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Importe del servicio" htmlFor={`${idPrefix}-final_price`}>
          <input
            id={`${idPrefix}-final_price`}
            name="final_price"
            type="number"
            inputMode="decimal"
            required
            min={0}
            max={10_000_000}
            step="0.01"
            className={`${fieldClass} tabular-nums`}
          />
        </Field>
        <Field label="Importe ya cobrado (0 = pendiente)" htmlFor={`${idPrefix}-amount_paid`}>
          <input
            id={`${idPrefix}-amount_paid`}
            name="amount_paid"
            defaultValue={0}
            required
            type="number"
            inputMode="decimal"
            min={0}
            max={10_000_000}
            step="0.01"
            className={`${fieldClass} tabular-nums`}
          />
        </Field>
        <Field label="Medio de pago" htmlFor={`${idPrefix}-method`}>
          <select id={`${idPrefix}-method`} name="method" required defaultValue="efectivo" className={fieldClass}>
            {METHODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Observaciones del servicio" htmlFor={`${idPrefix}-notes`}>
        <textarea id={`${idPrefix}-notes`} name="notes" rows={3} maxLength={1000} className={fieldClass} />
      </Field>
      <Field label="Nota interna" htmlFor={`${idPrefix}-internal_note`}>
        <textarea
          id={`${idPrefix}-internal_note`}
          name="internal_note"
          rows={3}
          maxLength={4000}
          className={fieldClass}
        />
      </Field>
    </ActionForm>
  )
}
