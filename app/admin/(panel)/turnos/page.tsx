import type { Metadata } from "next"
import Link from "next/link"
import { CalendarDays, ChevronRight, Plus } from "lucide-react"
import { Badge, EmptyState, PageHeader, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDateTime, money } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, PAYMENT_STATUS, appointmentTone, paymentTone } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Turnos" }

type Row = {
  id: string
  status: string
  payment_status: string | null
  service: string
  requested_start: string | null
  confirmed_start: string | null
  agreed_price: number | null
  contact_name: string | null
  client: { full_name: string; whatsapp: string | null } | null
}

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "solicitado", label: "Solicitados" },
  { key: "confirmado", label: "Confirmados" },
  { key: "reprogramado", label: "Reprogramados" },
  { key: "realizado", label: "Realizados" },
  { key: "cancelado", label: "Cancelados" },
] as const

type SearchParams = Promise<{ estado?: string; q?: string }>

export default async function TurnosPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireAdmin()
  const { estado = "", q = "" } = await searchParams
  const status = FILTERS.some((f) => f.key === estado) ? estado : ""
  const search = q.trim().slice(0, 60)

  let query = supabase
    .from("appointments")
    .select(
      "id, status, payment_status, service, requested_start, confirmed_start, agreed_price, contact_name, client:clients!inner(full_name, whatsapp, is_demo)",
    )
    .eq("client.is_demo", false)
    .order("requested_start", { ascending: false, nullsFirst: false })
    .limit(200)
  if (status) query = query.eq("status", status)
  const { data } = await query.returns<Row[]>()

  const needle = search.toLowerCase()
  const now = Date.now()
  const rows = (data ?? [])
    .map((r) => ({ ...r, start: r.confirmed_start ?? r.requested_start }))
    .filter(
      (r) =>
        !needle ||
        [r.contact_name, r.client?.full_name, r.client?.whatsapp, r.service].some((v) => v?.toLowerCase().includes(needle)),
    )
  const upcoming = rows.filter((r) => r.start && new Date(r.start).getTime() >= now).reverse()
  const past = rows.filter((r) => !r.start || new Date(r.start).getTime() < now)

  const hrefFor = (key: string) => {
    const params = new URLSearchParams()
    if (key) params.set("estado", key)
    if (search) params.set("q", search)
    const qs = params.toString()
    return qs ? `/admin/turnos?${qs}` : "/admin/turnos"
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Turnos"
        description="Tocá un turno para abrir su ficha: estado, vehículos, pagos y notas en un solo lugar."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/turnos/calendario" className={secondaryButtonClass}>
              <CalendarDays className="size-4" aria-hidden="true" />
              Calendario
            </Link>
            <Link
              href="/admin/turnos/nuevo"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nuevo turno
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-3">
        <form method="get" className="flex gap-2">
          {status && <input type="hidden" name="estado" value={status} />}
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <input id="q" name="q" defaultValue={search} placeholder="Buscar por nombre, WhatsApp o servicio" className={fieldClass} />
          <button type="submit" className={secondaryButtonClass}>
            Buscar
          </button>
        </form>
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={hrefFor(f.key)}
              aria-current={status === f.key ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-4 text-sm transition",
                status === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      <TurnoList title={`Próximos (${upcoming.length})`} rows={upcoming} />
      <TurnoList title={`Anteriores (${past.length})`} rows={past} />
    </div>
  )
}

function TurnoList({ title, rows }: { title: string; rows: (Row & { start: string | null })[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState>No hay turnos.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/turnos/${r.id}`} className="flex items-center gap-3 p-4 transition hover:bg-surface/60">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.contact_name || r.client?.full_name}</span>
                    <Badge tone={appointmentTone(r.status)}>{APPOINTMENT_STATUS[r.status] ?? r.status}</Badge>
                    <Badge tone={paymentTone(r.payment_status ?? "pendiente")}>
                      {PAYMENT_STATUS[r.payment_status ?? "pendiente"] ?? r.payment_status}
                    </Badge>
                  </div>
                  <span className="truncate text-sm text-muted-foreground">
                    {r.start ? formatDateTime(r.start) : "Sin fecha"} · {r.service}
                    {r.agreed_price ? ` · ${money(r.agreed_price)}` : ""}
                  </span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
