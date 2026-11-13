import type { Metadata } from "next"
import { AdminBookingForm } from "@/components/admin/admin-booking-form"
import { Card, PageHeader, TextLink } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { getVehiclePrices } from "@/lib/prices"

export const metadata: Metadata = { title: "Nuevo turno manual" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type PrefillClient = { id: string; full_name: string; whatsapp: string | null }
type PrefillAppointment = { address: string; water_supply: string }

export default async function NewManualAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; desde?: string }>
}) {
  const { cliente, desde } = await searchParams
  const { supabase } = await requireAdmin()

  const [prices, { data: client }, { data: fromAppointment }] = await Promise.all([
    getVehiclePrices(),
    cliente && UUID_RE.test(cliente)
      ? supabase.from("clients").select("id, full_name, whatsapp").eq("id", cliente).maybeSingle().returns<PrefillClient>()
      : Promise.resolve({ data: null }),
    desde && UUID_RE.test(desde)
      ? supabase
          .from("appointments")
          .select("address, water_supply")
          .eq("id", desde)
          .eq("client_id", cliente ?? "")
          .maybeSingle()
          .returns<PrefillAppointment>()
      : Promise.resolve({ data: null }),
  ])

  return (
    <>
      <PageHeader
        title={client ? `Nuevo turno para ${client.full_name}` : "Nuevo turno manual"}
        description="Mismo formulario que la reserva web. Queda como solicitud: después le enviás la propuesta desde el turno."
        actions={
          <TextLink href={desde && fromAppointment ? `/admin/turnos/${desde}` : client ? `/admin/clientes/${client.id}` : "/admin/turnos"}>
            Volver
          </TextLink>
        }
      />

      <Card>
        <AdminBookingForm
          prices={prices}
          client={client}
          defaultAddress={fromAppointment?.address ?? ""}
          defaultNoWater={fromAppointment?.water_supply === "propia"}
        />
      </Card>
    </>
  )
}
