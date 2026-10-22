import { NextResponse, type NextRequest } from "next/server"
import { isInCoverage } from "@/lib/coverage"
import { createServiceClient } from "@/lib/supabase/service"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const service = sp.get("service")
  if (service && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(service))
    return NextResponse.json({ error: "Servicio inválido." }, { status: 400 })
  const lat = Number(sp.get("lat")),
    lng = Number(sp.get("lng")),
    vehicles = Number(sp.get("vehicles") ?? 1)
  if (
    !sp.get("lat") ||
    !sp.get("lng") ||
    !isInCoverage(lat, lng) ||
    !Number.isInteger(vehicles) ||
    vehicles < 1 ||
    vehicles > 10
  ) {
    return NextResponse.json(
      { error: "Elegí una dirección dentro de la cobertura y la cantidad de vehículos." },
      { status: 400 },
    )
  }
  const client = createServiceClient()
  if (!client) return NextResponse.json({ error: "Disponibilidad temporalmente no disponible." }, { status: 503 })
  const { data, error } = await client.rpc("zone_availability", {
    p_lat: lat,
    p_lng: lng,
    p_vehicles: vehicles,
    p_service: service,
  })
  if (error)
    return NextResponse.json({ error: "No pudimos consultar la disponibilidad. Intentá nuevamente." }, { status: 503 })
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } })
}
