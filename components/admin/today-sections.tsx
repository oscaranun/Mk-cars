import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Clock, MapPin, MessageCircle } from "lucide-react"
import { manageAppointment } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, EmptyState, SectionTitle, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatDateTime, formatTime, money, whatsappLink } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, INQUIRY_STATUS, appointmentTone, inquiryTone } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

type ClientRef = { full_name: string; whatsapp: string } | null

export type PendingAppt = {
  id: string
  requested_start: string | null
  address: string
  service: string
  status: string
  created_at: string
  updated_at: string
  clients: ClientRef
}

export type AgendaAppt = {
  id: string
  confirmed_start: string
  duration_minutes: number
  address: string
  service: string
  status: string
  clients: ClientRef
}

export type OpenInquiry = {
  id: string
  created_at: string
  service: string
  commercial_status: string
  clients: ClientRef
}

export type UnpaidService = {
  id: string
  performed_at: string
  wash_type: string
  final_price: number
  amount_paid: number
  clients: { id: string; full_name: string } | null
}

const LATE_MINUTES = 120
const smallButton = "min-h-9 px-4"

function waitingLabel(since: string, now: number) {
  const minutes = Math.max(0, Math.round((now - new Date(since).getTime()) / 60000))
  if (minutes < 60) return { text: `${minutes} min`, minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { text: `${hours} h`, minutes }
  return { text: `${Math.floor(hours / 24)} d`, minutes }
}

const mapsLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

function Section({
  title,
  count,
  href,
  linkLabel,
  children,
}: {
  title: string
  count: number
  href: string
  linkLabel: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        aside={
          <Link href={href} className="inline-flex items-center gap-1 text-sm text-electric hover:underline">
            {linkLabel} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        <span className="inline-flex items-center gap-2">
          {title}
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        </span>
      </SectionTitle>
      {children}
    </section>
  )
}

function WhatsappButton({ phone, name }: { phone: string; name: string }) {
  return (
    <a
      href={`${whatsappLink(phone)}?text=${encodeURIComponent(`Hola ${name}, te escribimos de MK Cars.`)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(secondaryButtonClass, smallButton)}
    >
      <MessageCircle className="size-4 text-emerald-300" aria-hidden="true" />
      WhatsApp
    </a>
  )
}

export function PendingSection({ items, now }: { items: PendingAppt[]; now: number }) {
  return (
    <Section title="Por confirmar" count={items.length} href="/admin/turnos" linkLabel="Ver turnos">
      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((a) => {
            const name = a.clients?.full_name ?? "Cliente"
            const waiting = waitingLabel(a.status === "solicitado" ? a.created_at : a.updated_at, now)
            const late = a.status !== "esperando_cliente" && waiting.minutes > LATE_MINUTES
            return (
              <li key={a.id}>
                <Card className={cn("flex flex-col gap-3 p-4", late && "border-red-400/50")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <Link href={`/admin/turnos/${a.id}`} className="font-medium hover:underline">
                        {name}
                      </Link>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {a.requested_start ? formatDateTime(a.requested_start) : "Sin horario"} · {a.service}
                      </span>
                      <span className="text-sm text-muted-foreground">{a.address}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS[a.status] ?? a.status}</Badge>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs tabular-nums",
                          late ? "font-medium text-red-200" : "text-muted-foreground",
                        )}
                      >
                        <Clock className="size-3.5" aria-hidden="true" />
                        {a.status === "esperando_cliente" ? "Propuesta hace" : "Esperando hace"} {waiting.text}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {a.status === "esperando_cliente" ? (
                      <ActionForm
                        action={manageAppointment}
                        submitLabel="Cliente aceptó"
                        submitClassName={cn(primaryButtonClass, smallButton)}
                        inline
                      >
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="action" value="client_accepted" />
                      </ActionForm>
                    ) : a.requested_start ? (
                      <ActionForm
                        action={manageAppointment}
                        submitLabel="Confirmar"
                        submitClassName={cn(primaryButtonClass, smallButton)}
                        confirmText={`¿Confirmar el turno de ${name} para el ${formatDateTime(a.requested_start)}?`}
                        inline
                      >
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="action" value="confirm" />
                      </ActionForm>
                    ) : null}
                    <Link href={`/admin/turnos/${a.id}`} className={cn(secondaryButtonClass, smallButton)}>
                      Proponer otro horario
                    </Link>
                    {a.clients?.whatsapp && <WhatsappButton phone={a.clients.whatsapp} name={name} />}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState>No hay turnos esperando confirmación.</EmptyState>
      )}
    </Section>
  )
}

export function AgendaSection({ items }: { items: AgendaAppt[] }) {
  return (
    <Section title="Agenda de hoy" count={items.length} href="/admin/turnos" linkLabel="Ver turnos">
      {items.length ? (
        <ol className="flex flex-col gap-2">
          {items.map((a) => {
            const end = new Date(new Date(a.confirmed_start).getTime() + a.duration_minutes * 60000)
            return (
              <li key={a.id}>
                <Card className="flex gap-4 p-4">
                  <div className="flex w-14 shrink-0 flex-col text-sm tabular-nums">
                    <span className="font-semibold">{formatTime(a.confirmed_start)}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(end)}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/turnos/${a.id}`} className="truncate font-medium hover:underline">
                        {a.clients?.full_name ?? "Cliente"}
                      </Link>
                      <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS[a.status] ?? a.status}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{a.service}</span>
                    <a
                      href={mapsLink(a.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-electric hover:underline"
                    >
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{a.address}</span>
                      <span className="sr-only">(abrir en Google Maps)</span>
                    </a>
                  </div>
                </Card>
              </li>
            )
          })}
        </ol>
      ) : (
        <EmptyState>No hay turnos confirmados para hoy.</EmptyState>
      )}
    </Section>
  )
}

export function InquiriesSection({ items }: { items: OpenInquiry[] }) {
  return (
    <Section title="Consultas sin responder" count={items.length} href="/admin/consultas" linkLabel="Ver consultas">
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((i) => {
            const name = i.clients?.full_name ?? "Cliente"
            return (
              <li key={i.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatDateTime(i.created_at)} · {i.service}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={inquiryTone(i.commercial_status)}>
                      {INQUIRY_STATUS[i.commercial_status] ?? i.commercial_status}
                    </Badge>
                    {i.clients?.whatsapp && <WhatsappButton phone={i.clients.whatsapp} name={name} />}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState>No hay consultas pendientes de respuesta.</EmptyState>
      )}
    </Section>
  )
}

export function UnpaidSection({ items }: { items: UnpaidService[] }) {
  const total = items.reduce((sum, s) => sum + Number(s.final_price) - Number(s.amount_paid), 0)
  return (
    <Section title="Cobros pendientes" count={items.length} href="/admin/cobros" linkLabel="Ver cobros">
      {items.length ? (
        <>
          <p className="text-sm text-muted-foreground">
            Saldo total a cobrar: <span className="font-semibold tabular-nums text-foreground">{money(total)}</span>
          </p>
          <ul className="flex flex-col gap-2">
            {items.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {s.clients ? (
                      <Link href={`/admin/clientes/${s.clients.id}`} className="truncate font-medium hover:underline">
                        {s.clients.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium">Cliente</span>
                    )}
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatDateTime(s.performed_at)} · {s.wash_type}
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-amber-200">
                    {money(Number(s.final_price) - Number(s.amount_paid))}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState>No hay servicios con saldo pendiente.</EmptyState>
      )}
    </Section>
  )
}
