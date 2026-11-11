import type { Metadata } from "next"
import { registerCompletedService } from "@/app/admin/(panel)/offer-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Card, Field, PageHeader, SectionTitle, TextLink, fieldClass } from "@/components/admin/ui"
import { WHATSAPP_DEFAULT_PREFIX } from "@/lib/booking"
import { requireAdmin } from "@/lib/admin/auth"
import { VEHICLE_CATEGORY } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Cargar lavado realizado" }

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

function todayInMendoza() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Mendoza" }).format(new Date())
}

export default async function CompletedServicePage() {
  await requireAdmin()

  return (
    <>
      <PageHeader
        title="Cargar lavado realizado"
        description="Para lavados que ya se hicieron. Queda registrado como realizado y cobrado, sin pasar por solicitud ni propuesta, y no se envía ninguna notificación."
        actions={<TextLink href="/admin/turnos">Volver a turnos</TextLink>}
      />

      <Card className="flex flex-col gap-4">
        <ActionForm action={registerCompletedService} submitLabel="Registrar lavado">
          <SectionTitle>Cliente</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellido" htmlFor="full_name">
              <input id="full_name" name="full_name" required minLength={2} maxLength={120} autoComplete="off" className={fieldClass} />
            </Field>
            <Field label="WhatsApp" htmlFor="whatsapp">
              <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" required placeholder="+54 9 261 555 1234" defaultValue={WHATSAPP_DEFAULT_PREFIX} className={fieldClass} />
            </Field>
            <Field label="Origen" htmlFor="source">
              <select id="source" name="source" required defaultValue="whatsapp" className={fieldClass}>
                {SOURCES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <SectionTitle>Vehículo y lavado</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de vehículo" htmlFor="vehicle_category">
              <select id="vehicle_category" name="vehicle_category" required defaultValue="auto" className={fieldClass}>
                {(["auto", "suv", "pickup"] as const).map((key) => (
                  <option key={key} value={key}>
                    {VEHICLE_CATEGORY[key] ?? key}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marca" htmlFor="brand">
              <input id="brand" name="brand" maxLength={60} className={fieldClass} />
            </Field>
            <Field label="Modelo" htmlFor="model">
              <input id="model" name="model" maxLength={60} className={fieldClass} />
            </Field>
            <Field label="Tipo de lavado" htmlFor="service">
              <input id="service" name="service" required minLength={2} maxLength={120} defaultValue="Lavado completo" className={fieldClass} />
            </Field>
            <Field label="Fecha" htmlFor="date">
              <input id="date" name="date" type="date" required max={todayInMendoza()} defaultValue={todayInMendoza()} className={fieldClass} />
            </Field>
            <Field label="Hora (07:00 a 20:00)" htmlFor="time">
              <input id="time" name="time" type="time" required min="07:00" max="20:00" step={900} className={fieldClass} />
            </Field>
            <Field label="Operador (opcional)" htmlFor="operator">
              <input id="operator" name="operator" maxLength={80} className={fieldClass} />
            </Field>
          </div>

          <SectionTitle>Domicilio</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dirección" htmlFor="address">
              <input id="address" name="address" required minLength={5} maxLength={200} className={fieldClass} />
            </Field>
            <Field label="Barrio" htmlFor="neighborhood">
              <input id="neighborhood" name="neighborhood" maxLength={120} className={fieldClass} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="no_water" className="size-5 accent-primary" />
            Llevamos agua propia
          </label>

          <SectionTitle>Cobro</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Importe del servicio" htmlFor="final_price">
              <input id="final_price" name="final_price" type="number" inputMode="numeric" required min={0} max={10_000_000} step={100} className={`${fieldClass} tabular-nums`} />
            </Field>
            <Field label="Importe cobrado (vacío = total)" htmlFor="amount_paid">
              <input id="amount_paid" name="amount_paid" type="number" inputMode="numeric" min={0} max={10_000_000} step={100} className={`${fieldClass} tabular-nums`} />
            </Field>
            <Field label="Medio de pago" htmlFor="method">
              <select id="method" name="method" required defaultValue="efectivo" className={fieldClass}>
                {METHODS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Observaciones del servicio" htmlFor="notes">
            <textarea id="notes" name="notes" rows={3} maxLength={1000} className={fieldClass} />
          </Field>
          <Field label="Nota interna" htmlFor="internal_note">
            <textarea id="internal_note" name="internal_note" rows={3} maxLength={4000} className={fieldClass} />
          </Field>
        </ActionForm>
      </Card>
    </>
  )
}
