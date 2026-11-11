import { QueryErrorNotice } from "@/components/admin/query-error-notice"
import type { Metadata } from "next"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin/auth"
import { DraggableCard, DropColumn } from "@/components/admin/board-dnd"
import { QuickAppointmentControls } from "@/components/admin/quick-appointment-controls"
import { CreateAppointmentLink, PageHeader } from "@/components/admin/ui"
import { addDays, formatDateTime, money, todayArgentina } from "@/lib/admin/format"
import { PENDING_APPOINTMENT_STATUSES, VEHICLE_CATEGORY } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Tablero" }

type Row = {
  id: string
  status: string
  payment_status: string
  amount_paid: number
  agreed_price: number | null
  adjusted_price: number | null
  service_started_at: string | null
  discount: number | null
  confirmed_start: string | null
  requested_start: string | null
  service: string | null
  contact_name: string | null
  clients: { id: string; full_name: string | null } | null
  vehicles: { brand: string | null; model: string | null; category: string | null; plate: string | null } | null
}

const COLUMNS = [
  { key: "solicitado", title: "Solicitado", drop: "solicitado" },
  { key: "confirmado", title: "Confirmado", drop: "confirmado" },
  { key: "realizado", title: "Realizado sin cobrar", drop: "realizado" },
  { key: "cobrado", title: "Cobrado (últimos 30 días)", drop: null, hint: "Para cobrar, usá \"Guardar pago\" en la tarjeta." },
] as const

function columnOf(a: Row) {
  if (PENDING_APPOINTMENT_STATUSES.includes(a.status)) return "solicitado"
  if (a.status === "confirmado") return "confirmado"
  if (a.status === "realizado") return a.payment_status === "pagado" ? "cobrado" : "realizado"
  return null
}

function Card({ a }: { a: Row }) {
  const name = a.contact_name || a.clients?.full_name || "Sin nombre"
  const vehicle = a.vehicles
    ? [a.vehicles.category && VEHICLE_CATEGORY[a.vehicles.category], a.vehicles.brand, a.vehicles.model].filter(Boolean).join(" · ")
    : null
  const when = a.confirmed_start ?? a.requested_start
  const total = Math.max(0, Number(a.adjusted_price ?? Math.max(0, Number(a.agreed_price ?? 0) - Number(a.discount ?? 0))))
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        {a.clients ? (
          <Link href={`/admin/clientes/${a.clients.id}`} className="font-semibold leading-tight hover:text-electric">
            {name}
          </Link>
        ) : (
          <span className="font-semibold leading-tight">{name}</span>
        )}
        {total > 0 && <span className="shrink-0 text-sm font-semibold tabular-nums">{money(total)}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        {[a.service, when && formatDateTime(when)].filter(Boolean).join(" · ")}
      </p>
      {vehicle && (
        <p className="text-xs text-muted-foreground">
          {vehicle}
          {a.vehicles?.plate && <span className="ml-1 rounded bg-surface px-1.5 font-mono text-foreground">{a.vehicles.plate}</span>}
        </p>
      )}
      <div className="flex flex-wrap gap-3 text-xs">
        <Link href={`/admin/turnos/${a.id}`} className="text-electric hover:underline">
          Ver turno
        </Link>
        <Link href={`/admin/turnos/${a.id}/comprobante`} className="text-electric hover:underline">
          Fotos y comprobante
        </Link>
      </div>
      <details className="rounded-xl bg-surface px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Cambiar estado o cobrar</summary>
        <div className="pt-2">
          <QuickAppointmentControls appointment={a} />
        </div>
      </details>
    </article>
  )
}

export default async function TableroPage() {
  const { supabase } = await requireAdmin()
  const since = `${addDays(todayArgentina(), -30)}T00:00:00-03:00`
  const fields =
    "id, status, payment_status, amount_paid, agreed_price, discount, adjusted_price, service_started_at, confirmed_start, requested_start, service, contact_name, clients(id, full_name), vehicles(brand, model, category, plate)"

  const [open, unpaid, done] = await Promise.all([
    supabase.from("appointments").select(fields).in("status", [...PENDING_APPOINTMENT_STATUSES, "confirmado"]).order("confirmed_start", { ascending: true, nullsFirst: false }).limit(200),
    supabase.from("appointments").select(fields).eq("status", "realizado").neq("payment_status", "pagado").order("updated_at", { ascending: true }).limit(200),
    supabase.from("appointments").select(fields).eq("status", "realizado").eq("payment_status", "pagado").gte("updated_at", since).order("updated_at", { ascending: false }).limit(200),
  ])
  if ([open,unpaid,done].some(result=>result.error)) return <QueryErrorNotice subject="los turnos y saldos" />

  const rows = [...((open.data ?? []) as unknown as Row[]), ...((unpaid.data ?? []) as unknown as Row[]), ...((done.data ?? []) as unknown as Row[])]
  const byColumn = new Map<string, Row[]>(COLUMNS.map((c) => [c.key, []]))
  for (const r of rows) {
    const col = columnOf(r)
    if (col) byColumn.get(col)?.push(r)
  }

  return (
    <>
      <PageHeader
        title="Tablero"
        description="Arrastrá cada turno a la columna que corresponda. Desde la tarjeta también podés cambiar el estado o cobrar."
        actions={<CreateAppointmentLink />}
      />
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        {COLUMNS.map((c) => {
          const items = byColumn.get(c.key) ?? []
          return (
            <DropColumn key={c.key} status={c.drop} title={c.title} count={items.length} hint={"hint" in c ? c.hint : undefined}>
              {items.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Sin turnos</li>
              ) : (
                items.map((a) => (
                  <DraggableCard key={a.id} id={a.id}>
                    <Card a={a} />
                  </DraggableCard>
                ))
              )}
            </DropColumn>
          )
        })}
      </div>
    </>
  )
}
