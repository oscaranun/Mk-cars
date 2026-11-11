import type { Metadata } from "next"
import { createManualAppointment } from "@/app/admin/(panel)/offer-actions"
import { ActionForm } from "@/components/admin/action-form"
import { vehicleOptionLabel } from "@/components/admin/appointment-vehicle-tools"
import { Card, Field, PageHeader, SectionTitle, TextLink, fieldClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatWhatsapp } from "@/lib/admin/format"
import { WHATSAPP_DEFAULT_PREFIX } from "@/lib/booking"
import { VehicleDurationFields } from "@/components/admin/vehicle-duration-fields"

export const metadata: Metadata = { title: "Nuevo turno manual" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SOURCES: [string, string][] = [
  ["whatsapp", "WhatsApp"],
  ["telefono", "Teléfono"],
  ["instagram", "Instagram"],
  ["presencial", "Presencial"],
  ["otro", "Otro"],
]

type Prefill = {
  client: {
    id: string
    full_name: string
    whatsapp: string
    vehicles: { id: string; category: string; brand: string | null; model: string | null; plate: string | null }[]
  } | null
  fromAppointment: { address: string; neighborhood: string | null; water_supply: string; vehicle_id: string | null } | null
}

export default async function NewManualAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; desde?: string }>
}) {
  const { cliente, desde } = await searchParams
  const { supabase } = await requireAdmin()

  const [{ data: settings }, { data: client }, { data: fromAppointment }] = await Promise.all([
    supabase.from("settings").select("duration_defaults").eq("id", 1).maybeSingle(),
    cliente && UUID_RE.test(cliente)
      ? supabase
          .from("clients")
          .select("id, full_name, whatsapp, vehicles(id, category, brand, model, plate)")
          .eq("id", cliente)
          .maybeSingle()
          .returns<NonNullable<Prefill["client"]>>()
      : Promise.resolve({ data: null }),
    desde && UUID_RE.test(desde)
      ? supabase
          .from("appointments")
          .select("address, neighborhood, water_supply, vehicle_id")
          .eq("id", desde)
          .eq("client_id", cliente ?? "")
          .maybeSingle()
          .returns<NonNullable<Prefill["fromAppointment"]>>()
      : Promise.resolve({ data: null }),
  ])
  const defaults: Record<string, number> = { auto: 60, suv: 75, pickup: 90, ...(settings?.duration_defaults ?? {}) }
  const vehicles = client?.vehicles ?? []
  // Suggest a vehicle other than the one already booked in the turno we came from.
  const suggestedVehicle = vehicles.find((v) => v.id !== fromAppointment?.vehicle_id)?.id ?? ""

  return (
    <>
      <PageHeader
        title={client ? `Nuevo turno para ${client.full_name}` : "Nuevo turno manual"}
        description={
          client
            ? "Turno aparte, con su propio horario. Queda como solicitud: después le enviás la propuesta desde el turno."
            : "Para pedidos que llegan por WhatsApp, teléfono u otro medio. Queda como solicitud: después le enviás la propuesta desde el turno."
        }
        actions={
          <TextLink href={desde && fromAppointment ? `/admin/turnos/${desde}` : client ? `/admin/clientes/${client.id}` : "/admin/turnos"}>
            Volver
          </TextLink>
        }
      />

      <Card className="flex flex-col gap-4">
        <ActionForm action={createManualAppointment} submitLabel="Crear turno">
          <SectionTitle>Cliente</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellido" htmlFor="full_name">
              <input
                id="full_name"
                name="full_name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={client?.full_name ?? ""}
                className={fieldClass}
              />
            </Field>
            <Field label="WhatsApp" htmlFor="whatsapp">
              <input
                id="whatsapp"
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
          {vehicles.length > 0 && (
            <Field label="Vehículo del cliente" htmlFor="vehicle_id">
              <select id="vehicle_id" name="vehicle_id" defaultValue={suggestedVehicle} className={fieldClass}>
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
            <VehicleDurationFields defaults={defaults} />
            <Field label={vehicles.length ? "Marca (si es nuevo)" : "Marca"} htmlFor="brand">
              <input id="brand" name="brand" maxLength={60} className={fieldClass} />
            </Field>
            <Field label={vehicles.length ? "Modelo (si es nuevo)" : "Modelo"} htmlFor="model">
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
              <input id="address" name="address" required maxLength={200} defaultValue={fromAppointment?.address ?? ""} className={fieldClass} />
            </Field>
            <Field label="Barrio" htmlFor="neighborhood">
              <input id="neighborhood" name="neighborhood" maxLength={120} defaultValue={fromAppointment?.neighborhood ?? ""} className={fieldClass} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="no_water" defaultChecked={fromAppointment?.water_supply === "propia"} className="size-4 accent-primary" />
            No hay canilla disponible: llevamos agua propia
          </label>

          <Field label="Comentarios del cliente" htmlFor="client_notes">
            <textarea id="client_notes" name="client_notes" rows={3} maxLength={1000} className={fieldClass} />
          </Field>
          <Field label="Nota interna (no la ve el cliente)" htmlFor="internal_note">
            <textarea id="internal_note" name="internal_note" rows={3} maxLength={4000} className={fieldClass} />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="ignore_duplicate" defaultChecked={Boolean(client)} className="size-4 accent-[var(--primary)]" />
            Crear igual aunque el cliente ya tenga un turno activo
          </label>
        </ActionForm>
      </Card>
    </>
  )
}
