import type { Metadata } from "next"
import Link from "next/link"
import { Camera, MapPin, MessageCircle } from "lucide-react"
import { requireAdmin } from "@/lib/admin/auth"
import { QuickAppointmentControls } from "@/components/admin/quick-appointment-controls"
import { Badge, Card, EmptyState, Field, PageHeader, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatTime, isValidDate, money, startOfArgentinaDay, addDays, todayArgentina, whatsappLink } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, VEHICLE_CATEGORY, appointmentTone } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Mi recorrido" }

type Row = {
  id: string
  status: string
  payment_status: string
  amount_paid: number
  agreed_price: number | null
  discount: number | null
  confirmed_start: string | null
  service: string | null
  address: string | null
  neighborhood: string | null
  contact_name: string | null
  clients: { full_name: string | null; whatsapp: string | null } | null
  vehicles: { brand: string | null; model: string | null; category: string | null; plate: string | null } | null
}

export default async function RecorridoPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams
  const day = dia && isValidDate(dia) ? dia : todayArgentina()
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, status, payment_status, amount_paid, agreed_price, discount, confirmed_start, service, address, neighborhood, contact_name, clients(full_name, whatsapp), vehicles(brand, model, category, plate)",
    )
    .in("status", ["confirmado", "realizado"])
    .gte("confirmed_start", startOfArgentinaDay(day))
    .lt("confirmed_start", startOfArgentinaDay(addDays(day, 1)))
    .order("confirmed_start")
  const rows = (data ?? []) as unknown as Row[]
  const pendingCount = rows.filter((r) => r.status !== "realizado").length

  return (
    <>
      <PageHeader
        title="Mi recorrido"
        description={`${rows.length} servicios · ${pendingCount} por hacer`}
        actions={
          <form method="get" className="flex items-end gap-2">
            <Field label="Día" htmlFor="dia">
              <input id="dia" name="dia" type="date" defaultValue={day} className={fieldClass} />
            </Field>
            <button type="submit" className={secondaryButtonClass}>
              Ver
            </button>
          </form>
        }
      />
      {rows.length === 0 ? (
        <EmptyState>No hay servicios confirmados para este día.</EmptyState>
      ) : (
        <ol className="flex flex-col gap-4">
          {rows.map((r, i) => {
            const name = r.contact_name || r.clients?.full_name || "Cliente"
            const place = [r.address, r.neighborhood].filter(Boolean).join(", ")
            const total = Math.max(0, Number(r.agreed_price ?? 0) - Number(r.discount ?? 0))
            const vehicle = r.vehicles
              ? [r.vehicles.category && VEHICLE_CATEGORY[r.vehicles.category], r.vehicles.brand, r.vehicles.model].filter(Boolean).join(" ")
              : null
            return (
              <li key={r.id}>
                <Card className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold">{r.confirmed_start ? formatTime(r.confirmed_start) : "--:--"} · {name}</p>
                        <Badge tone={appointmentTone(r.status)}>{APPOINTMENT_STATUS[r.status] ?? r.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[r.service, vehicle, r.vehicles?.plate].filter(Boolean).join(" · ")}
                        {total > 0 && ` · ${money(total)}`}
                      </p>
                      {place && <p className="text-sm">{place}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {place && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place}, Mendoza`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className={primaryButtonClass}
                      >
                        <MapPin className="size-4" aria-hidden="true" />
                        Abrir en Maps
                      </a>
                    )}
                    {r.clients?.whatsapp && (
                      <a href={whatsappLink(r.clients.whatsapp)} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                        <MessageCircle className="size-4 text-emerald-400" aria-hidden="true" />
                        WhatsApp
                      </a>
                    )}
                    <Link href={`/admin/turnos/${r.id}/comprobante`} className={secondaryButtonClass}>
                      <Camera className="size-4" aria-hidden="true" />
                      Fotos y comprobante
                    </Link>
                  </div>
                  <QuickAppointmentControls appointment={r} />
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
