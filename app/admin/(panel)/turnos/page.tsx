import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { updateSettings } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import {
  Badge,
  Card,
  EmptyState,
  ExportLink,
  Field,
  FilterBar,
  PageHeader,
  SectionTitle,
  TableWrap,
  TextLink,
  fieldClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { addDays, argentinaParts, formatDateTime, formatTime, startOfArgentinaDay, todayArgentina } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, appointmentTone } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Turnos" }

type ApptRow = {
  id: string
  requested_start: string
  confirmed_start: string | null
  duration_minutes: number
  service: string
  address: string
  status: string
  clients: { full_name: string; whatsapp: string } | null
}

type SearchParams = Promise<{ mes?: string; estado?: string }>

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

const startOf = (a: ApptRow) => a.confirmed_start ?? a.requested_start

export default async function AppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()

  const today = todayArgentina()
  const month = params.mes && MONTH_RE.test(params.mes) ? params.mes : today.slice(0, 7)
  const monthStart = `${month}-01`
  const nextMonth = `${shiftMonth(month, 1)}-01`
  const fromISO = startOfArgentinaDay(monthStart)
  const toISO = startOfArgentinaDay(nextMonth)
  const estado = params.estado ?? "pendientes"

  const select = "id, requested_start, confirmed_start, duration_minutes, service, address, status, clients(full_name, whatsapp)"

  let listQuery = supabase.from("appointments").select(select).order("requested_start", { ascending: true }).limit(300)
  if (estado === "pendientes") listQuery = listQuery.in("status", ["solicitado", "reprogramado"])
  else if (APPOINTMENT_STATUS[estado]) listQuery = listQuery.eq("status", estado)

  const [calendar, list, settings] = await Promise.all([
    supabase
      .from("appointments")
      .select(select)
      .not("status", "in", "(rechazado,cancelado)")
      .or(
        `and(confirmed_start.gte.${fromISO},confirmed_start.lt.${toISO}),and(confirmed_start.is.null,requested_start.gte.${fromISO},requested_start.lt.${toISO})`,
      )
      .returns<ApptRow[]>(),
    listQuery.returns<ApptRow[]>(),
    supabase.from("settings").select("operational_capacity, default_duration_minutes").eq("id", 1).maybeSingle(),
  ])

  const byDay = new Map<string, ApptRow[]>()
  for (const a of calendar.data ?? []) {
    const day = argentinaParts(startOf(a)).date
    byDay.set(day, [...(byDay.get(day) ?? []), a])
  }
  for (const list of byDay.values()) list.sort((a, b) => startOf(a).localeCompare(startOf(b)))

  const firstWeekday = (new Date(`${monthStart}T00:00:00Z`).getUTCDay() + 6) % 7
  const daysInMonth = Number(addDays(nextMonth, -1).slice(8, 10))
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ]
  while (cells.length % 7) cells.push(null)

  const monthLabel = new Date(`${monthStart}T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
  const rows = list.data ?? []

  return (
    <>
      <PageHeader
        title="Turnos"
        description="La confirmación es manual: ningún turno se confirma solo."
        actions={<ExportLink entity="turnos" />}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold capitalize tracking-tight">{monthLabel}</h2>
          <div className="flex gap-2">
            <Link href={`/admin/turnos?mes=${shiftMonth(month, -1)}&estado=${estado}`} className={cn(secondaryButtonClass, "px-3")} aria-label="Mes anterior">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link href={`/admin/turnos?estado=${estado}`} className={secondaryButtonClass}>
              Hoy
            </Link>
            <Link href={`/admin/turnos?mes=${shiftMonth(month, 1)}&estado=${estado}`} className={cn(secondaryButtonClass, "px-3")} aria-label="Mes siguiente">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> Confirmado</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-300" /> Por confirmar</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-400" /> Realizado</span>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} aria-hidden="true" />
              const items = byDay.get(day) ?? []
              const isSunday = idx % 7 === 6
              return (
                <div
                  key={day}
                  className={cn(
                    "flex min-h-24 flex-col gap-1 rounded-2xl border border-border/70 bg-surface p-1.5",
                    day === today && "border-electric",
                    isSunday && "opacity-50",
                  )}
                >
                  <span className={cn("px-1 text-xs tabular-nums", day === today ? "font-semibold text-electric" : "text-muted-foreground")}>
                    {Number(day.slice(8))}
                  </span>
                  {items.slice(0, 3).map((a) => (
                    <Link
                      key={a.id}
                      href={`/admin/turnos/${a.id}`}
                      className={cn(
                        "truncate rounded-lg px-1.5 py-1 text-[11px] leading-tight transition hover:brightness-125",
                        a.status === "confirmado" && "bg-primary text-white",
                        a.status === "realizado" && "bg-emerald-500/25 text-emerald-200",
                        (a.status === "solicitado" || a.status === "reprogramado") && "bg-amber-300/20 text-amber-100",
                      )}
                      title={`${formatTime(startOf(a))} ${a.clients?.full_name ?? ""} — ${APPOINTMENT_STATUS[a.status]}`}
                    >
                      <span className="tabular-nums">{formatTime(startOf(a))}</span> {a.clients?.full_name ?? "Cliente"}
                    </Link>
                  ))}
                  {items.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{items.length - 3} más</span>}
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <SectionTitle>Listado</SectionTitle>
        <FilterBar resetHref="/admin/turnos">
          <input type="hidden" name="mes" value={month} />
          <Field label="Estado" htmlFor="estado" className="md:w-56">
            <select id="estado" name="estado" defaultValue={estado} className={fieldClass}>
              <option value="pendientes">Pendientes de confirmar</option>
              <option value="todos">Todos</option>
              {Object.entries(APPOINTMENT_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </FilterBar>

        {rows.length ? (
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Fecha y hora</th>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>Servicio</th>
                <th className={thClass}>Domicilio</th>
                <th className={thClass}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="transition hover:bg-sky/40">
                  <td className={`${tdClass} tabular-nums`}>
                    <TextLink href={`/admin/turnos/${a.id}`}>{formatDateTime(startOf(a))}</TextLink>
                    {!a.confirmed_start && <p className="text-xs text-muted-foreground">Horario solicitado</p>}
                  </td>
                  <td className={tdClass}>{a.clients?.full_name ?? "—"}</td>
                  <td className={tdClass}>{a.service}</td>
                  <td className={tdClass}>{a.address}</td>
                  <td className={tdClass}>
                    <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS[a.status] ?? a.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState>No hay turnos con ese estado.</EmptyState>
        )}
      </section>

      <Card className="flex flex-col gap-4">
        <SectionTitle>Disponibilidad</SectionTitle>
        <p className="text-sm text-muted-foreground text-pretty">
          Lunes a sábado de 9:00 a 18:00. La capacidad es la cantidad de turnos confirmados que pueden superponerse (por ejemplo,
          equipos trabajando en paralelo). Con capacidad 1 no se permite ninguna superposición.
        </p>
        <ActionForm action={updateSettings} submitLabel="Guardar disponibilidad" inline>
          <Field label="Capacidad simultánea" htmlFor="operational_capacity" className="w-44">
            <input
              id="operational_capacity"
              name="operational_capacity"
              type="number"
              min={1}
              max={20}
              required
              defaultValue={settings.data?.operational_capacity ?? 1}
              className={fieldClass}
            />
          </Field>
          <Field label="Duración por defecto (min)" htmlFor="default_duration_minutes" className="w-52">
            <input
              id="default_duration_minutes"
              name="default_duration_minutes"
              type="number"
              min={15}
              max={540}
              step={15}
              required
              defaultValue={settings.data?.default_duration_minutes ?? 90}
              className={fieldClass}
            />
          </Field>
        </ActionForm>
      </Card>
    </>
  )
}
