import type { Metadata } from "next"
import { createManualAppointment } from "@/app/admin/(panel)/offer-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Card, Field, PageHeader, SectionTitle, TextLink, fieldClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { VEHICLE_CATEGORY } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Nuevo turno manual" }

const SOURCES: [string, string][] = [
  ["whatsapp", "WhatsApp"],
  ["telefono", "Teléfono"],
  ["instagram", "Instagram"],
  ["presencial", "Presencial"],
  ["otro", "Otro"],
]

export default async function NewManualAppointmentPage() {
  await requireAdmin()

  return (
    <>
      <PageHeader
        title="Nuevo turno manual"
        description="Para pedidos que llegan por WhatsApp, teléfono u otro medio. Queda como solicitud: después le enviás la propuesta desde el turno."
        actions={<TextLink href="/admin/turnos">Volver a turnos</TextLink>}
      />

      <Card className="flex flex-col gap-4">
        <ActionForm action={createManualAppointment} submitLabel="Crear turno">
          <SectionTitle>Cliente</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellido" htmlFor="full_name">
              <input id="full_name" name="full_name" required minLength={2} maxLength={120} className={fieldClass} />
            </Field>
            <Field label="WhatsApp" htmlFor="whatsapp">
              <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" required placeholder="261 555 1234" className={fieldClass} />
            </Field>
            <Field label="Origen del pedido" htmlFor="source">
              <select id="source" name="source" required defaultValue="whatsapp" className={fieldClass}>
                {SOURCES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <SectionTitle>Vehículo y servicio</SectionTitle>
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
            <Field label="Servicio" htmlFor="service">
              <input id="service" name="service" maxLength={200} placeholder="Lavado completo" className={fieldClass} />
            </Field>
            <Field label="Precio acordado (opcional)" htmlFor="price">
              <input id="price" name="price" type="number" min={0} max={10_000_000} step={100} className={`${fieldClass} tabular-nums`} />
            </Field>
          </div>

          <SectionTitle>Domicilio</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dirección" htmlFor="address">
              <input id="address" name="address" required maxLength={200} className={fieldClass} />
            </Field>
            <Field label="Barrio" htmlFor="neighborhood">
              <input id="neighborhood" name="neighborhood" maxLength={120} className={fieldClass} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="no_water" className="size-4 accent-primary" />
            No hay canilla disponible: llevamos agua propia
          </label>

          <Field label="Comentarios del cliente" htmlFor="client_notes">
            <textarea id="client_notes" name="client_notes" rows={3} maxLength={1000} className={fieldClass} />
          </Field>
          <Field label="Nota interna (no la ve el cliente)" htmlFor="internal_note">
            <textarea id="internal_note" name="internal_note" rows={3} maxLength={4000} className={fieldClass} />
          </Field>
        </ActionForm>
      </Card>
    </>
  )
}
