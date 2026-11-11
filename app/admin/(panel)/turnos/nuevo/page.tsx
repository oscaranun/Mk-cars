import { ManualAppointmentForm } from "@/components/admin/manual-appointment-form"
import type { Metadata } from "next"
import { Card, PageHeader, TextLink } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"

export const metadata: Metadata = { title: "Nuevo turno manual" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
        <ManualAppointmentForm client={client} fromAppointment={fromAppointment} defaults={defaults} />
      </Card>
    </>
  )
}
