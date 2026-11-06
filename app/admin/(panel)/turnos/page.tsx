import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { updatePrices, updateSettings } from "@/app/admin/(panel)/crm-actions"
import { saveTransferSettings } from "@/app/admin/(panel)/offer-actions"
import { parsePrices } from "@/lib/prices"
import { ActionForm } from "@/components/admin/action-form"
import { DeletedNotice } from "@/components/admin/deleted-notice"
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
import { APPOINTMENT_STATUS, VEHICLE_CATEGORY, appointmentTone } from "@/lib/admin/labels"
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
  contact_name: string | null
  clients: { full_name: string; whatsapp: string } | null
}

type SearchParams = Promise<{ mes?: string; estado?: string; eliminada?: string }>

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

const startOf = (a: ApptRow) => a.confirmed_start ?? a.requested_start

function CalendarItem({ appt: a }: { appt: ApptRow }) {
  return (
    <Link
      href={`/admin/turnos/${a.id}`}
      className={cn(
        "truncate rounded-lg px-1.5 py-1 text-[11px] leading-tight transition hover:brightness-125",
        a.status === "confirmado" && "bg-primary text-white",
        a.status === "realizado" && "bg-emerald-500/25 text-emerald-200",
        ["solicitado", "reprogramado", "esperando_cliente"].includes(a.status) && "bg-amber-300/20 text-amber-100",
      )}
      title={`${formatTime(startOf(a))} ${a.contact_name ?? a.clients?.full_name ?? ""} — ${APPOINTMENT_STATUS[a.status]}`}
    >
      <span className="tabular-nums">{formatTime(startOf(a))}</span> {a.contact_name ?? a.clients?.full_name ?? "Cliente"}
    </Link>
  )
}

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

  const select = "id, requested_start, confirmed_start, duration_minutes, service, address, status, contact_name, clients(full_name, whatsapp)"

  let listQuery = supabase.from("appointments").select(select).order("requested_start", { ascending: true }).limit(300)
  if (estado === "pendientes") listQuery = listQuery.in("status", ["solicitado", "reprogramado", "esperando_cliente"])
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
    supabase.from("settings").select("operational_capacity, default_duration_minutes, duration_defaults, vehicle_prices").eq("id", 1).maybeSingle(),
  ])
  const prices = parsePrices(settings.data?.vehicle_prices)
  // Separate query: these columns only exist once migration 011 is installed.
  const transfer = await supabase
    .from("settings")
    .select("transfer_alias, transfer_holder, transfer_bank")
    .eq("id", 1)
    .maybeSingle()
    .returns<{ transfer_alias: string | null; transfer_holder: string | null; transfer_bank: string | null }>()

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
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/turnos/nuevo"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Nuevo turno manual
            </Link>
            <Link
              href="/admin/turnos/realizado"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cargar lavado realizado
            </Link>
            <ExportLink entity="turnos" />
          </div>
        }
      />

      {params.eliminada === "1" && <DeletedNotice />}

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
                return (
                <div
                  key={day}
                  className={cn(
                    "flex min-h-24 flex-col gap-1 rounded-2xl border border-border/70 bg-surface p-1.5",
                  day === today && "border-electric",
                  )}
                >
                  <span className={cn("px-1 text-xs tabular-nums", day === today ? "font-semibold text-electric" : "text-muted-foreground")}>
                    {Number(day.slice(8))}
                  </span>
                  {items.slice(0, 3).map((a) => (
                    <CalendarItem key={a.id} appt={a} />
                  ))}
                  {items.length > 3 && (
                    <details className="group flex flex-col gap-1">
                      <summary className="cursor-pointer list-none rounded-lg px-1 py-0.5 text-[11px] text-muted-foreground transition hover:text-foreground [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">+{items.length - 3} más</span>
                        <span className="hidden group-open:inline">Ver menos</span>
                      </summary>
                      <div className="mt-1 flex flex-col gap-1">
                        {items.slice(3).map((a) => (
                          <CalendarItem key={a.id} appt={a} />
                        ))}
                      </div>
                    </details>
                  )}
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
                  <td className={tdClass}>{a.contact_name ?? a.clients?.full_name ?? "—"}</td>
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
          Todos los días, incluso domingos y feriados, de 7:00 a 20:00. La capacidad es la cantidad de turnos confirmados que pueden superponerse (por ejemplo,
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
          {(["auto", "suv", "pickup"] as const).map((key) => (
            <Field key={key} label={`Duración ${VEHICLE_CATEGORY[key] ?? key} (min)`} htmlFor={`duration_${key}`} className="w-44">
              <input
                id={`duration_${key}`}
                name={`duration_${key}`}
                type="number"
                min={15}
                max={540}
                step={5}
                required
                defaultValue={settings.data?.duration_defaults?.[key] ?? { auto: 60, suv: 75, pickup: 90 }[key]}
                className={fieldClass}
              />
            </Field>
          ))}
        </ActionForm>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle>Precios por tipo de vehículo</SectionTitle>
        <p className="text-sm text-muted-foreground text-pretty">
          Única fuente de precios: la web y las nuevas reservas usan estos valores. Los turnos ya cargados conservan el precio aplicado.
        </p>
        {prices ? (
          <ActionForm action={updatePrices} submitLabel="Guardar precios" inline>
            {(["auto", "suv", "pickup"] as const).map((key) => (
              <Field key={key} label={VEHICLE_CATEGORY[key] ?? key} htmlFor={`price_${key}`} className="w-40">
                <input
                  id={`price_${key}`}
                  name={`price_${key}`}
                  type="number"
                  min={1}
                  max={10_000_000}
                  step={500}
                  required
                  defaultValue={prices[key]}
                  className={`${fieldClass} tabular-nums`}
                />
              </Field>
            ))}
          </ActionForm>
        ) : (
          <p className="text-sm text-destructive">No se pudieron leer los precios configurados.</p>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle>Datos para transferencia</SectionTitle>
        <p className="text-sm text-muted-foreground text-pretty">
          Se muestran al cliente recién cuando acepta la propuesta. El pago se registra en el turno solo después de verificarlo en tu cuenta.
        </p>
        {transfer.error ? (
          <p className="text-sm text-muted-foreground">Disponible cuando se instale la migración 011 en esta base.</p>
        ) : (
          <ActionForm action={saveTransferSettings} submitLabel="Guardar datos de transferencia" inline>
            <Field label="Alias o CBU/CVU" htmlFor="alias" className="w-full sm:w-56">
              <input id="alias" name="alias" maxLength={60} defaultValue={transfer.data?.transfer_alias ?? ""} className={fieldClass} />
            </Field>
            <Field label="Titular" htmlFor="holder" className="w-full sm:w-56">
              <input id="holder" name="holder" maxLength={120} defaultValue={transfer.data?.transfer_holder ?? ""} className={fieldClass} />
            </Field>
            <Field label="Banco o billetera" htmlFor="bank" className="w-full sm:w-48">
              <input id="bank" name="bank" maxLength={80} defaultValue={transfer.data?.transfer_bank ?? ""} className={fieldClass} />
            </Field>
          </ActionForm>
        )}
      </Card>
    </>
  )
}
