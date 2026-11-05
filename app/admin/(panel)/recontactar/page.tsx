import type { Metadata } from "next"
import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { EmptyState, PageHeader, TableWrap, TextLink, secondaryButtonClass, tdClass, thClass } from "@/components/admin/ui"
import { FollowUpForm } from "@/components/admin/follow-up-form"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDate, formatWhatsapp, money, whatsappLink } from "@/lib/admin/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Recontactar" }

const OPTIONS = [30, 45, 60, 90]

type Row = {
  id: string
  full_name: string
  whatsapp: string
  marketing_consent: boolean | null
  follow_up_at: string | null
  follow_up_note: string | null
  last_contacted_at: string | null
  services: { performed_at: string; amount_paid: number | null }[]
  appointments: { status: string; appointment_offers: { status: string; created_at: string }[] }[]
  inquiries: { commercial_status: string }[]
}

const UPCOMING = ["solicitado", "reprogramado", "esperando_cliente", "confirmado"]

function inactiveMessage(name: string) {
  const first = name.split(" ")[0]
  return `Hola ${first}! Te escribimos de MK Cars. Hace un tiempo que no lavamos tu auto, ¿querés que te reservemos un turno esta semana? Vamos a tu casa o trabajo.`
}

function followUpMessage(name: string) {
  const first = name.split(" ")[0]
  return `Hola ${first}! Te escribimos de MK Cars como quedamos. ¿Querés que te pasemos turnos disponibles para el lavado?`
}

function reasonFor(c: Row) {
  if (c.appointments.some((a) => a.appointment_offers.some((o) => o.status === "mas_adelante"))) return "Postergó la propuesta"
  if (c.inquiries.some((i) => i.commercial_status === "no_contratado")) return "No contrató, aceptó seguimiento"
  return "Pidió otro contacto"
}

function WriteLink({ whatsapp, text }: { whatsapp: string; text: string }) {
  return (
    <a
      href={`${whatsappLink(whatsapp)}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(secondaryButtonClass, "min-h-9 px-4")}
    >
      <MessageCircle className="size-4 text-emerald-300" aria-hidden="true" />
      Escribir
    </a>
  )
}

export default async function RecontactPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const days = OPTIONS.includes(Number(params.dias)) ? Number(params.dias) : 30
  const cutoff = Date.now() - days * 86_400_000
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())

  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, whatsapp, marketing_consent, follow_up_at, follow_up_note, last_contacted_at, services(performed_at, amount_paid), appointments(status, appointment_offers(status, created_at)), inquiries(commercial_status)",
    )
    .is("archived_at", null)
    .limit(2000)
    .returns<Row[]>()
  if (error) console.error("[admin] recontact query failed:", error.code, error.message)
  const clients = data ?? []

  const postponed = (c: Row) =>
    c.appointments.some((a) => a.status !== "confirmado" && a.status !== "realizado" && a.appointment_offers.some((o) => o.status === "mas_adelante"))

  const followUps = clients
    .filter((c) => c.follow_up_at || postponed(c))
    .sort((a, b) => (a.follow_up_at ?? "9999").localeCompare(b.follow_up_at ?? "9999"))
  const followUpIds = new Set(followUps.map((c) => c.id))

  const inactive = clients
    .filter((c) => !followUpIds.has(c.id) && c.services.length > 0 && !c.appointments.some((a) => UPCOMING.includes(a.status)))
    .map((c) => {
      const last = c.services.reduce((max, s) => (s.performed_at > max ? s.performed_at : max), c.services[0].performed_at)
      const total = c.services.reduce((sum, s) => sum + Number(s.amount_paid ?? 0), 0)
      return { ...c, last, total, visits: c.services.length }
    })
    .filter((c) => new Date(c.last).getTime() < cutoff)
    .sort((a, b) => b.total - a.total)

  return (
    <>
      <PageHeader
        title="Recontactar"
        description="Clientes con seguimiento pendiente: postergaron, no contrataron pero aceptaron seguimiento, o pidieron que los contactemos más adelante."
      />

      <section aria-labelledby="seguimientos" className="flex flex-col gap-4">
        <h2 id="seguimientos" className="font-display text-xl font-semibold">
          Seguimientos <span className="text-muted-foreground">({followUps.length})</span>
        </h2>
        {followUps.length ? (
          <ul className="flex flex-col gap-3">
            {followUps.map((c) => {
              const due = c.follow_up_at && c.follow_up_at <= today
              return (
                <li key={c.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <TextLink href={`/admin/clientes/${c.id}`}>{c.full_name}</TextLink>
                      <span className="text-xs tabular-nums text-muted-foreground">{formatWhatsapp(c.whatsapp)}</span>
                      <span className="text-xs text-muted-foreground">{reasonFor(c)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={cn("text-sm tabular-nums", due ? "font-semibold text-amber-200" : "text-muted-foreground")}>
                        {c.follow_up_at ? `${due ? "Contactar: " : "Próximo: "}${formatDate(c.follow_up_at)}` : "Sin fecha"}
                      </span>
                      <WriteLink whatsapp={c.whatsapp} text={followUpMessage(c.full_name)} />
                    </div>
                  </div>
                  {c.follow_up_note && <p className="text-sm text-muted-foreground">{c.follow_up_note}</p>}
                  {c.last_contacted_at && (
                    <p className="text-xs text-muted-foreground">Último contacto: {formatDate(c.last_contacted_at)}</p>
                  )}
                  <FollowUpForm clientId={c.id} defaultDate={c.follow_up_at} />
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState>No hay seguimientos programados.</EmptyState>
        )}
      </section>

      <section aria-labelledby="inactivos" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="inactivos" className="font-display text-xl font-semibold">
            Sin lavar hace más de {days} días <span className="text-muted-foreground">({inactive.length})</span>
          </h2>
          <p className="text-sm text-muted-foreground">Sin turnos pendientes. Ordenados por lo que gastaron.</p>
        </div>

        <nav aria-label="Antigüedad" className="flex flex-wrap gap-2">
          {OPTIONS.map((d) => (
            <Link
              key={d}
              href={`/admin/recontactar?dias=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                d === days ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              +{d} días
            </Link>
          ))}
        </nav>

        {inactive.length ? (
          <TableWrap>
            <thead>
              <tr>
                <th className={thClass}>Cliente</th>
                <th className={thClass}>Último lavado</th>
                <th className={thClass}>Lavados</th>
                <th className={thClass}>Total gastado</th>
                <th className={thClass}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {inactive.map((c) => (
                <tr key={c.id}>
                  <td className={tdClass}>
                    <div className="flex flex-col gap-0.5">
                      <TextLink href={`/admin/clientes/${c.id}`}>{c.full_name}</TextLink>
                      <span className="text-xs tabular-nums text-muted-foreground">{formatWhatsapp(c.whatsapp)}</span>
                      {c.marketing_consent === false && <span className="text-xs text-amber-200">No aceptó recibir promociones</span>}
                    </div>
                  </td>
                  <td className={cn(tdClass, "tabular-nums")}>
                    {formatDate(c.last)}
                    <span className="block text-xs text-muted-foreground">
                      hace {Math.floor((Date.now() - new Date(c.last).getTime()) / 86_400_000)} días
                    </span>
                  </td>
                  <td className={cn(tdClass, "tabular-nums")}>{c.visits}</td>
                  <td className={cn(tdClass, "tabular-nums")}>{money(c.total)}</td>
                  <td className={cn(tdClass, "text-right")}>
                    <div className="flex flex-col items-end gap-2">
                      <WriteLink whatsapp={c.whatsapp} text={inactiveMessage(c.full_name)} />
                      <FollowUpForm clientId={c.id} compact />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState>No hay clientes para recontactar en este rango.</EmptyState>
        )}
      </section>
    </>
  )
}
