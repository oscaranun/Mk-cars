import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { BlockDateForm, WeekGrid, type AgendaItem } from "@/components/admin/agenda-week"
import { PageHeader, secondaryButtonClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { addDays, argentinaParts, isValidDate, startOfArgentinaDay, todayArgentina } from "@/lib/admin/format"
import { PENDING_APPOINTMENT_STATUSES } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Agenda" }

type ApptRow = {
  id: string
  requested_start: string | null
  confirmed_start: string | null
  duration_minutes: number | null
  address: string
  service: string
  status: string
  clients: { full_name: string } | null
}

function mondayOf(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return addDays(date, weekday === 0 ? -6 : 1 - weekday)
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const today = todayArgentina()
  const monday = mondayOf(params.semana && isValidDate(params.semana) ? params.semana : today)
  const days = Array.from({ length: 6 }, (_, i) => addDays(monday, i))
  const fromISO = startOfArgentinaDay(monday)
  const toISO = startOfArgentinaDay(addDays(monday, 7))

  const [confirmed, pending, blocked] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, requested_start, confirmed_start, duration_minutes, address, service, status, clients(full_name)")
      .in("status", ["confirmado", "realizado"])
      .gte("confirmed_start", fromISO)
      .lt("confirmed_start", toISO)
      .returns<ApptRow[]>(),
    supabase
      .from("appointments")
      .select("id, requested_start, confirmed_start, duration_minutes, address, service, status, clients(full_name)")
      .in("status", PENDING_APPOINTMENT_STATUSES)
      .gte("requested_start", fromISO)
      .lt("requested_start", toISO)
      .returns<ApptRow[]>(),
    supabase.from("blocked_dates").select("day, reason").gte("day", monday).lte("day", addDays(monday, 6)),
  ])

  const items: AgendaItem[] = [...(confirmed.data ?? []), ...(pending.data ?? [])]
    .map((a) => {
      const start = (a.status === "confirmado" || a.status === "realizado" ? a.confirmed_start : a.requested_start)!
      return {
        id: a.id,
        start,
        day: argentinaParts(start).date,
        duration: a.duration_minutes ?? 60,
        name: a.clients?.full_name ?? "Cliente",
        address: a.address,
        status: a.status,
      }
    })
    .sort((x, y) => x.start.localeCompare(y.start))

  const blockedMap = Object.fromEntries((blocked.data ?? []).map((b) => [b.day as string, (b.reason as string) ?? ""]))

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Turnos de la semana. Los pendientes aparecen con borde punteado."
        actions={
          <>
            <Link href={`/admin/agenda?semana=${addDays(monday, -7)}`} className={secondaryButtonClass} aria-label="Semana anterior">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/admin/agenda" className={secondaryButtonClass}>
              Esta semana
            </Link>
            <Link href={`/admin/agenda?semana=${addDays(monday, 7)}`} className={secondaryButtonClass} aria-label="Semana siguiente">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </>
        }
      />

      <WeekGrid days={days} today={today} items={items} blocked={blockedMap} />

      <BlockDateForm today={today} />
    </>
  )
}
