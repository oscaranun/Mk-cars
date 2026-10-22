import type { Metadata } from "next"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin/auth"
import {
  addDays,
  argentinaParts,
  formatDateTime,
  formatTime,
  isValidDate,
  money,
  todayArgentina,
  whatsappLink,
} from "@/lib/admin/format"
import { REQUEST_STATUS, WEEKDAYS, type Zone } from "@/lib/zones/types"
import { APPOINTMENT_STATUS } from "@/lib/admin/labels"
import { ActionForm } from "@/components/admin/action-form"
import { WhatsappComposer } from "@/components/admin/whatsapp-composer"
import {
  Card,
  Field,
  PageHeader,
  SectionTitle,
  fieldClass,
  secondaryButtonClass,
  TableWrap,
  thClass,
  tdClass,
} from "@/components/admin/ui"
import { assignAppointmentUnit, manageZoneRequest } from "../zonas/actions"
import type { MobileUnit, ZoneSettings } from "@/lib/zones/types"

export const metadata: Metadata = { title: "Agenda de servicios" }
type RequestRow = {
  id: string
  zone_id: string | null
  requested_day: string | null
  status: string
  proposed_start: string | null
  duration_minutes: number | null
  agreed_price: number | null
  vehicle_count: number
  appointment_id: string | null
  mobile_unit_id: string | null
  planned_minutes: number
  payload: {
    full_name: string
    whatsapp: string
    address: string
    neighborhood?: string
    service: string
    vehicles: { brand: string; model: string; category: string }[]
    notes?: string
  }
}
type AppointmentRow = {
  id: string
  mobile_unit_id: string | null
  confirmed_start: string | null
  requested_start: string
  status: string
  address: string
  service: string
  duration_minutes: number
  agreed_price: number | null
  clients: { full_name: string; whatsapp: string } | null
  appointment_vehicles: { vehicles: { brand: string; model: string; category: string } | null }[]
  appointment_proposals?: { proposed_start: string; status: string }[]
}
type EventRow = { request_id: string; action: string; created_at: string; details: { start?: string; reason?: string } }

function RequestCard({
  request: r,
  zone,
  minutes,
  today,
  events,
  units,
  settings,
}: {
  request: RequestRow
  zone?: Zone
  minutes: number
  today: string
  events: EventRow[]
  units: MobileUnit[]
  settings: ZoneSettings
}) {
  const p = r.payload
  const initial = r.proposed_start ? argentinaParts(r.proposed_start) : { date: r.requested_day ?? today, time: "" }
  const vehicles = p.vehicles.map((v) => [v.category, v.brand, v.model].filter(Boolean).join(" ")).join(" · ")
  const message = r.proposed_start
    ? `Hola ${p.full_name}, te contactamos desde MK Cars. Para ${p.service} en ${p.address}, te proponemos el ${formatDateTime(r.proposed_start)}. Vehículos: ${vehicles}. Importe: ${r.agreed_price == null ? "a confirmar" : money(r.agreed_price)}. ¿Aceptás el día y horario? La reserva se confirma cuando aceptes.`
    : ""
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{p.full_name}</h3>
        <span className="text-sm text-electric">{REQUEST_STATUS[r.status] ?? r.status}</span>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Día solicitado</dt>
          <dd>{r.requested_day ?? "A coordinar"} · sin horario elegido</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Zona / barrio</dt>
          <dd>
            {zone?.name ?? "Revisión manual"} · {p.neighborhood || "Barrio a verificar"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dirección</dt>
          <dd>{p.address}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vehículos y servicio</dt>
          <dd>
            {vehicles} · {p.service}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Duración estimada</dt>
          <dd>{r.duration_minutes ?? r.planned_minutes ?? r.vehicle_count * minutes} min</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Precio</dt>
          <dd>{r.agreed_price == null ? "A confirmar" : money(r.agreed_price)}</dd>
        </div>
        {p.notes && (
          <div>
            <dt className="text-muted-foreground">Observaciones</dt>
            <dd>{p.notes}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-3">
        <a href={whatsappLink(p.whatsapp)} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
          WhatsApp
        </a>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={secondaryButtonClass}
        >
          Google Maps
        </a>
      </div>
      <ActionForm
        action={manageZoneRequest}
        submitLabel={r.status === "propuesta" ? "Guardar otra propuesta" : "Proponer horario"}
      >
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="action" value="propose" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Día propuesto" htmlFor={`date-${r.id}`}>
            <input
              id={`date-${r.id}`}
              type="date"
              name="date"
              min={today}
              defaultValue={initial.date}
              className={fieldClass}
              required
            />
          </Field>
          <Field label="Hora propuesta" htmlFor={`time-${r.id}`}>
            <input
              id={`time-${r.id}`}
              type="time"
              name="time"
              min={settings.day_start.slice(0, 5)}
              max={settings.day_end.slice(0, 5)}
              defaultValue={initial.time}
              className={fieldClass}
              required
            />
          </Field>
          <Field label="Duración total (minutos)" htmlFor={`duration-${r.id}`}>
            <input
              id={`duration-${r.id}`}
              type="number"
              name="duration"
              min={15}
              max={540}
              defaultValue={r.duration_minutes ?? Math.min(540, r.planned_minutes ?? r.vehicle_count * minutes)}
              className={fieldClass}
              required
            />
          </Field>
          <Field label="Importe acordado (opcional)" htmlFor={`price-${r.id}`}>
            <input
              id={`price-${r.id}`}
              name="price"
              inputMode="decimal"
              defaultValue={r.agreed_price ?? ""}
              className={fieldClass}
            />
          </Field>
          <Field label="Unidad móvil" htmlFor={`unit-${r.id}`}>
            <select
              id={`unit-${r.id}`}
              name="mobile_unit_id"
              defaultValue={r.mobile_unit_id ?? units.find((u) => u.is_primary)?.id}
              className={fieldClass}
              required
            >
              {units
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </ActionForm>
      {r.status === "propuesta" && (
        <>
          <p className="text-sm">
            Propuesta actual: {formatDateTime(r.proposed_start)}. Revisá los turnos confirmados de ese día antes de
            enviarla.
          </p>
          <WhatsappComposer phone={p.whatsapp} initialMessage={message} label="Abrir propuesta en WhatsApp" />
          <p className="text-xs text-muted-foreground">
            Abrir WhatsApp no acredita envío, lectura ni aceptación. Registrá la respuesta recibida manualmente.
          </p>
          <div className="flex flex-wrap gap-3">
            <ActionForm
              action={manageZoneRequest}
              submitLabel="Cliente aceptó: confirmar"
              confirmText="¿El cliente aceptó expresamente esta propuesta por WhatsApp? Se volverá a verificar el cupo y la disponibilidad antes de crear el turno confirmado."
            >
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="action" value="client_accepted" />
            </ActionForm>
            <ActionForm
              action={manageZoneRequest}
              submitLabel="Pidió otra alternativa"
              submitClassName={secondaryButtonClass}
            >
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="action" value="client_rejected" />
            </ActionForm>
          </div>
        </>
      )}
      <details>
        <summary className="cursor-pointer text-sm">Cancelar solicitud</summary>
        <ActionForm
          action={manageZoneRequest}
          submitLabel="Cancelar solicitud"
          confirmText="¿Cancelar esta solicitud conservando su historial?"
        >
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="action" value="cancel" />
          <label className="text-xs">
            Motivo
            <input name="reason" minLength={3} maxLength={200} required className={fieldClass} />
          </label>
        </ActionForm>
      </details>
      {events.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">Historial de la solicitud</summary>
          <ul className="mt-2 flex flex-col gap-2 text-xs text-muted-foreground">
            {events.map((e, i) => (
              <li key={i}>
                {formatDateTime(e.created_at)} · {e.action}
                {e.details.start ? ` · ${formatDateTime(e.details.start)}` : ""}
                {e.details.reason ? ` · ${e.details.reason}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  )
}

export default async function ServiceAgenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; pagina?: string; estado?: string }>
}) {
  const { supabase, isAdmin } = await requireAdmin()
  if (!isAdmin) return null
  const params = await searchParams,
    today = todayArgentina()
  const selected = params.dia && isValidDate(params.dia) ? params.dia : today
  const weekday = new Date(`${selected}T12:00:00Z`).getUTCDay()
  const monday = addDays(selected, weekday === 0 ? -6 : 1 - weekday)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const page = Math.min(10000, Math.max(0, Number.parseInt(params.pagina ?? "0") || 0))
  let pendingQuery = supabase
    .from("zone_booking_requests")
    .select("*", { count: "exact" })
    .in("status", ["recibida", "propuesta", "espera", "revision"])
    .order("created_at")
    .range(page * 30, page * 30 + 29)
  if (params.estado && ["recibida", "propuesta", "espera", "revision"].includes(params.estado))
    pendingQuery = pendingQuery.eq("status", params.estado)
  const [zones, settings, requests, appointments, scheduledRequests, plans, units, legacyRequests] = await Promise.all([
    supabase.from("operating_zones").select("*").returns<Zone[]>(),
    supabase.from("zone_booking_settings").select("*").eq("id", 1).single(),
    pendingQuery.returns<RequestRow[]>(),
    supabase
      .from("appointments")
      .select(
        "id,mobile_unit_id,confirmed_start,requested_start,status,address,service,duration_minutes,agreed_price,clients(full_name,whatsapp),appointment_vehicles(vehicles(brand,model,category))",
      )
      .in("status", ["confirmado", "realizado"])
      .gte("confirmed_start", `${monday}T00:00:00-03:00`)
      .lt("confirmed_start", `${addDays(monday, 7)}T00:00:00-03:00`)
      .order("confirmed_start")
      .limit(501)
      .returns<AppointmentRow[]>(),
    supabase
      .from("zone_booking_requests")
      .select(
        "id,requested_day,proposed_start,status,vehicle_count,duration_minutes,planned_minutes,mobile_unit_id,appointment_id,zone_id,payload",
      )
      .in("status", ["recibida", "propuesta", "espera", "confirmada"])
      .or(
        `and(requested_day.gte.${monday},requested_day.lte.${days[6]}),and(proposed_start.gte.${monday}T00:00:00-03:00,proposed_start.lt.${addDays(monday, 7)}T00:00:00-03:00)`,
      )
      .limit(1001)
      .returns<RequestRow[]>(),
    Promise.all(
      days.map(async (d) => {
        const [plan, used, free] = await Promise.all([
          supabase.rpc("zone_day_plan", { p_day: d }),
          supabase.rpc("zone_day_used", { p_day: d }),
          supabase.rpc("zone_day_free_minutes", { p_day: d }),
        ])
        return {
          day: d,
          plan: plan.data?.[0],
          used: used.data,
          free: free.data,
          error: plan.error ?? used.error ?? free.error,
        }
      }),
    ),
    supabase.from("mobile_units").select("*").order("name").returns<MobileUnit[]>(),
    supabase
      .from("appointments")
      .select(
        "id,mobile_unit_id,requested_start,confirmed_start,status,address,service,duration_minutes,agreed_price,clients(full_name,whatsapp),appointment_vehicles(vehicles(brand,model,category)),appointment_proposals(proposed_start,status)",
      )
      .in("status", ["solicitado", "reprogramado", "esperando_cliente"])
      .order("requested_start")
      .limit(501)
      .returns<AppointmentRow[]>(),
  ])
  if (
    [zones, settings, requests, appointments, scheduledRequests, units, legacyRequests].some((r) => r.error) ||
    plans.some((r) => r.error)
  )
    return (
      <>
        <PageHeader title="Agenda de servicios" />
        <Card>
          La agenda por zonas no está disponible. Verificá la migración 010 y los permisos. La agenda y los turnos
          actuales siguen disponibles.
        </Card>
      </>
    )
  const events = requests.data?.length
    ? await supabase
        .from("zone_booking_events")
        .select("request_id,action,details,created_at")
        .in(
          "request_id",
          requests.data.map((r) => r.id),
        )
        .order("created_at", { ascending: false })
        .limit(1000)
        .returns<EventRow[]>()
    : { data: [], error: null }
  const byId = new Map(zones.data?.map((z) => [z.id, z]))
  const confirmed = appointments.data ?? []
  const weekRequests = scheduledRequests.data ?? []
  const pending = weekRequests.filter((r) => r.status !== "confirmada")
  const legacyPending = legacyRequests.data ?? []
  const legacyDay = (a: AppointmentRow) =>
    argentinaParts(a.appointment_proposals?.find((p) => p.status === "pendiente")?.proposed_start ?? a.requested_start)
      .date
  return (
    <>
      <PageHeader
        title="Agenda de servicios"
        description="Recorridos por unidad móvil. Solicitudes sin horario, propuestas y turnos confirmados."
        actions={
          <Link href="/admin/zonas" className={secondaryButtonClass}>
            Zonas y recorridos
          </Link>
        }
      />
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field label="Día de la agenda" htmlFor="agenda-day">
          <input type="date" id="agenda-day" name="dia" defaultValue={selected} className={fieldClass} />
        </Field>
        <button className={secondaryButtonClass}>Ver día y semana</button>
      </form>
      {(confirmed.length > 500 || pending.length > 1000 || legacyPending.length > 500) && (
        <p role="alert">
          La semana supera el límite de visualización. Los cupos se calculan con todos los registros; las listas y la
          ocupación detallada pueden estar incompletas.
        </p>
      )}
      <SectionTitle>Semana del {monday}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map(({ day, plan, used, free }) => {
          const dayConfirmed = confirmed.filter(
            (a) => a.confirmed_start && argentinaParts(a.confirmed_start).date === day,
          )
          const dayPending = pending.filter(
            (r) => (r.proposed_start ? argentinaParts(r.proposed_start).date : r.requested_day) === day,
          )
          const oldPending = legacyPending.filter((a) => legacyDay(a) === day)
          const minutes =
            dayConfirmed.reduce((s, a) => s + a.duration_minutes, 0) +
            oldPending.reduce((s, a) => s + a.duration_minutes, 0) +
            dayPending
              .filter((r) => r.status !== "espera")
              .reduce(
                (s, r) =>
                  s + (r.duration_minutes ?? r.planned_minutes ?? r.vehicle_count * settings.data.minutes_per_vehicle),
                0,
              )
          return (
            <Card key={day} className="flex flex-col gap-2">
              <Link href={`?dia=${day}`} className="font-semibold">
                {WEEKDAYS[new Date(`${day}T12:00Z`).getUTCDay()]} {day.slice(5)}
              </Link>
              <p className="text-sm">
                {plan?.enabled
                  ? plan.flexible
                    ? "Zona flexible"
                    : plan.zone_ids.map((id: string) => byId.get(id)?.name ?? "Zona").join(", ") || "Sin zonas"
                  : "Jornada bloqueada"}
              </p>
              <p className="text-xs">
                {dayConfirmed.length} reservas · {dayPending.length + oldPending.length} solicitudes
              </p>
              <p className="text-xs">
                {plan?.enabled ? Math.max(0, plan.capacity - Number(used ?? 0)) : 0} cupos libres de{" "}
                {plan?.capacity ?? 0} vehículos
              </p>
              <p className="text-xs">
                {minutes} min de servicio estimados · {Number(free ?? 0)} min libres, descontando pausas, traslados y
                margen. {units.data?.filter((u) => u.active).length} unidades activas.
              </p>
            </Card>
          )
        })}
      </div>
      <SectionTitle>Servicios del {selected}</SectionTitle>
      <TableWrap>
        <thead>
          <tr>
            {[
              "Horario",
              "Cliente / dirección",
              "Barrio / vehículo",
              "Servicio / duración",
              "Precio / estado",
              "Acciones",
            ].map((h) => (
              <th key={h} className={thClass}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {confirmed
            .filter((a) => a.confirmed_start && argentinaParts(a.confirmed_start).date === selected)
            .map((a) => (
              <tr key={a.id}>
                <td className={tdClass}>{formatTime(a.confirmed_start!)}</td>
                <td className={tdClass}>
                  {a.clients?.full_name}
                  <br />
                  {a.address}
                </td>
                <td className={tdClass}>
                  {weekRequests.find((r) => r.appointment_id === a.id)?.payload.neighborhood || "Barrio a verificar"}
                  <br />
                  {a.appointment_vehicles
                    .map((v) =>
                      v.vehicles
                        ? [v.vehicles.category, v.vehicles.brand, v.vehicles.model].filter(Boolean).join(" ")
                        : "Vehículo",
                    )
                    .join(" · ") || "Ver ficha"}
                </td>
                <td className={tdClass}>
                  {a.service}
                  <br />
                  {a.duration_minutes} min
                </td>
                <td className={tdClass}>
                  {a.agreed_price == null ? "A confirmar" : money(a.agreed_price)}
                  <br />
                  {APPOINTMENT_STATUS[a.status] ?? a.status}
                </td>
                <td className={tdClass}>
                  <p className="text-xs">
                    {units.data?.find((u) => u.id === (a.mobile_unit_id ?? units.data?.find((u) => u.is_primary)?.id))
                      ?.name ?? "Unidad por asignar"}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Link href={`/admin/turnos/${a.id}`}>Gestionar turno</Link>
                    {a.clients && (
                      <a href={whatsappLink(a.clients.whatsapp)} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Maps
                    </a>
                    {a.status === "confirmado" && (
                      <ActionForm
                        action={assignAppointmentUnit}
                        submitLabel="Reasignar unidad"
                        submitClassName={secondaryButtonClass}
                      >
                        <input name="id" type="hidden" value={a.id} />
                        <select
                          aria-label={`Unidad para ${a.clients?.full_name ?? "el turno"}`}
                          name="mobile_unit_id"
                          className={fieldClass}
                          defaultValue={a.mobile_unit_id ?? units.data?.find((u) => u.is_primary)?.id}
                        >
                          {units.data
                            ?.filter((u) => u.active)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                        </select>
                      </ActionForm>
                    )}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </TableWrap>
      <p className="text-sm text-muted-foreground">
        Para reprogramar o cancelar un turno confirmado, abrí su ficha. El flujo actual conserva propuestas, aceptación
        e historial.
      </p>
      <SectionTitle>Solicitudes pendientes ({requests.count ?? 0})</SectionTitle>
      {legacyPending.length > 0 && (
        <Card className="flex flex-col gap-3">
          <SectionTitle>Solicitudes del formulario anterior</SectionTitle>
          <p className="text-sm text-muted-foreground">
            Conservan su fecha y horario originales. Gestioná sus propuestas y respuestas desde la ficha habitual.
          </p>
          <ul className="flex flex-col gap-2">
            {legacyPending.slice(0, 500).map((a) => (
              <li key={a.id} className="text-sm">
                <Link href={`/admin/turnos/${a.id}`} className="underline">
                  {a.clients?.full_name ?? "Cliente"} ·{" "}
                  {formatDateTime(
                    a.appointment_proposals?.find((p) => p.status === "pendiente")?.proposed_start ?? a.requested_start,
                  )}
                </Link>{" "}
                · {a.address} · {APPOINTMENT_STATUS[a.status] ?? a.status}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <form method="get" className="flex flex-wrap gap-3">
        <input type="hidden" name="dia" value={selected} />
        <select
          aria-label="Filtrar solicitudes"
          name="estado"
          defaultValue={params.estado ?? ""}
          className={fieldClass}
        >
          <option value="">Todas las pendientes</option>
          {Object.entries(REQUEST_STATUS)
            .filter(([s]) => !["confirmada", "cancelada"].includes(s))
            .map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
        </select>
        <button className={secondaryButtonClass}>Filtrar</button>
      </form>
      {!requests.data?.length && <Card>No hay solicitudes pendientes para este filtro.</Card>}
      {events.error && <p role="alert">No se pudo cargar el historial de solicitudes.</p>}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {requests.data?.map((r) => (
          <RequestCard
            key={r.id + ":" + r.proposed_start + ":" + r.status}
            request={r}
            zone={r.zone_id ? byId.get(r.zone_id) : undefined}
            minutes={settings.data.minutes_per_vehicle}
            units={units.data ?? []}
            settings={settings.data}
            today={today}
            events={(events.data ?? []).filter((e) => e.request_id === r.id)}
          />
        ))}
      </div>
      <div className="flex gap-3">
        {page > 0 && (
          <Link
            className={secondaryButtonClass}
            href={`?dia=${selected}&estado=${params.estado ?? ""}&pagina=${page - 1}`}
          >
            Anteriores
          </Link>
        )}
        {(requests.count ?? 0) > (page + 1) * 30 && (
          <Link
            className={secondaryButtonClass}
            href={`?dia=${selected}&estado=${params.estado ?? ""}&pagina=${page + 1}`}
          >
            Siguientes
          </Link>
        )}
      </div>
    </>
  )
}
