import type { SupabaseClient } from "@supabase/supabase-js"

export const TEST_CLIENT_PREFIX = "TEST MK CARS"

export const isTestClientName = (name: string | null | undefined) =>
  typeof name === "string" && name.trim().toUpperCase().startsWith(TEST_CLIENT_PREFIX)

export type TestBookingSummary = {
  clientId: string
  clientName: string
  counts: {
    inquiries: number
    appointments: number
    appointmentVehicles: number
    vehicles: number
    services: number
    payments: number
    history: number
  }
  historyEntityIds: string[]
  /** Reasons the deletion would touch records that belong to someone else. Empty means safe. */
  conflicts: string[]
}

const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id)

/**
 * Collects everything owned by a test client and checks that none of it is referenced
 * by another client's records, so deleting the client row (whose FKs cascade only into
 * its own rows) cannot alter real data.
 */
export async function getTestBookingSummary(
  supabase: SupabaseClient,
  clientId: string,
): Promise<{ summary: TestBookingSummary | null; error: string | null }> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("id", clientId)
    .maybeSingle()
  if (clientError) return { summary: null, error: "No se pudo leer el cliente." }
  if (!client) return { summary: null, error: "El cliente no existe." }
  if (!isTestClientName(client.full_name)) {
    return { summary: null, error: `Solo se pueden eliminar reservas de prueba (${TEST_CLIENT_PREFIX}).` }
  }

  const [vehiclesRes, inquiriesRes, appointmentsRes, servicesRes] = await Promise.all([
    supabase.from("vehicles").select("id").eq("client_id", clientId),
    supabase.from("inquiries").select("id").eq("client_id", clientId),
    supabase.from("appointments").select("id").eq("client_id", clientId),
    supabase.from("services").select("id").eq("client_id", clientId),
  ])
  if (vehiclesRes.error || inquiriesRes.error || appointmentsRes.error || servicesRes.error) {
    return { summary: null, error: "No se pudieron leer los registros asociados." }
  }
  const vehicleIds = ids(vehiclesRes.data)
  const inquiryIds = ids(inquiriesRes.data)
  const appointmentIds = ids(appointmentsRes.data)
  const serviceIds = ids(servicesRes.data)
  const ownIds = [...inquiryIds, ...appointmentIds, ...serviceIds]
  const none = ["00000000-0000-0000-0000-000000000000"]
  const or = (v: string[]) => (v.length ? v : none)

  const [avOwn, payments, history, foreignInquiries, foreignAppointments, foreignServices, avByVehicle] =
    await Promise.all([
      supabase.from("appointment_vehicles").select("id", { count: "exact", head: true }).in("appointment_id", or(appointmentIds)),
      supabase.from("payments").select("id", { count: "exact", head: true }).in("service_id", or(serviceIds)),
      supabase.from("status_history").select("entity_id").in("entity_id", or(ownIds)),
      supabase.from("inquiries").select("id", { count: "exact", head: true }).neq("client_id", clientId).in("vehicle_id", or(vehicleIds)),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .neq("client_id", clientId)
        .or(`vehicle_id.in.(${or(vehicleIds).join(",")}),inquiry_id.in.(${or(inquiryIds).join(",")})`),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .neq("client_id", clientId)
        .or(`vehicle_id.in.(${or(vehicleIds).join(",")}),appointment_id.in.(${or(appointmentIds).join(",")})`),
      supabase.from("appointment_vehicles").select("appointment_id").in("vehicle_id", or(vehicleIds)),
    ])
  const failed = [avOwn, payments, history, foreignInquiries, foreignAppointments, foreignServices, avByVehicle].find(
    (r) => r.error,
  )
  if (failed?.error) {
    console.error("[admin] test booking summary:", failed.error.code, failed.error.message)
    return { summary: null, error: "No se pudieron verificar las relaciones." }
  }

  const own = new Set(appointmentIds)
  const foreignLines = (avByVehicle.data ?? []).filter((r) => !own.has(r.appointment_id as string)).length
  const conflicts: string[] = []
  if (foreignInquiries.count) conflicts.push(`${foreignInquiries.count} consulta(s) de otros clientes usan sus vehículos.`)
  if (foreignAppointments.count) conflicts.push(`${foreignAppointments.count} turno(s) de otros clientes están vinculados.`)
  if (foreignServices.count) conflicts.push(`${foreignServices.count} servicio(s) de otros clientes están vinculados.`)
  if (foreignLines) conflicts.push(`${foreignLines} vehículo(s) figuran en turnos de otros clientes.`)

  const historyEntityIds = [...new Set((history.data ?? []).map((h) => h.entity_id as string))]

  return {
    error: null,
    summary: {
      clientId,
      clientName: client.full_name,
      counts: {
        inquiries: inquiryIds.length,
        appointments: appointmentIds.length,
        appointmentVehicles: avOwn.count ?? 0,
        vehicles: vehicleIds.length,
        services: serviceIds.length,
        payments: payments.count ?? 0,
        history: (history.data ?? []).length,
      },
      historyEntityIds,
      conflicts,
    },
  }
}
