import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, MessageCircle } from "lucide-react"
import { addVehicle, updateClient } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, DetailRow, EmptyState, Field, SectionTitle, TextLink, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDate, formatDateTime, formatWhatsapp, money, whatsappLink } from "@/lib/admin/format"
import {
  APPOINTMENT_STATUS,
  INQUIRY_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  VEHICLE_CATEGORY,
  appointmentTone,
  inquiryTone,
  paymentTone,
} from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Ficha de cliente" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ClientDetail = {
  id: string
  full_name: string
  whatsapp: string
  email: string | null
  source: string
  notes: string | null
  created_at: string
  last_interaction_at: string | null
  marketing_consent: boolean
  privacy_consent_at: string | null
  vehicles: { id: string; category: string; brand: string | null; model: string | null; created_at: string }[]
  inquiries: { id: string; created_at: string; service: string; commercial_status: string; source: string }[]
  appointments: {
    id: string
    requested_start: string
    confirmed_start: string | null
    service: string
    status: string
    address: string
  }[]
  services: {
    id: string
    performed_at: string
    wash_type: string
    final_price: number
    amount_paid: number
    payment_status: string
    payments: { id: string; amount: number; method: string; paid_at: string }[]
  }[]
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const { supabase } = await requireAdmin()

  const { data: client } = await supabase
    .from("clients")
    .select(
      `id, full_name, whatsapp, email, source, notes, created_at, last_interaction_at, marketing_consent, privacy_consent_at,
       vehicles(id, category, brand, model, created_at),
       inquiries(id, created_at, service, commercial_status, source),
       appointments(id, requested_start, confirmed_start, service, status, address),
       services(id, performed_at, wash_type, final_price, amount_paid, payment_status, payments(id, amount, method, paid_at))`,
    )
    .eq("id", id)
    .maybeSingle()
    .returns<ClientDetail>()
  if (!client) notFound()

  const byDateDesc = <T,>(list: T[], key: (x: T) => string) => [...list].sort((a, b) => key(b).localeCompare(key(a)))
  const inquiries = byDateDesc(client.inquiries, (i) => i.created_at)
  const appointments = byDateDesc(client.appointments, (a) => a.confirmed_start ?? a.requested_start)
  const services = byDateDesc(client.services, (s) => s.performed_at)
  const payments = byDateDesc(
    services.flatMap((s) => s.payments.map((p) => ({ ...p, wash: s.wash_type }))),
    (p) => p.paid_at,
  )
  const totalPaid = services.reduce((sum, s) => sum + Number(s.amount_paid), 0)
  const balance = services.reduce((sum, s) => sum + Number(s.final_price) - Number(s.amount_paid), 0)

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/admin/clientes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Clientes
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{client.full_name}</h1>
            <p className="text-sm text-muted-foreground">
              Cliente desde {formatDate(client.created_at)} · Origen: {client.source}
            </p>
          </div>
          <a href={whatsappLink(client.whatsapp)} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
            <MessageCircle className="size-4 text-whatsapp" aria-hidden="true" />
            Escribir por WhatsApp
          </a>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4">
          <DetailRow label="Lavados realizados">
            <span className="text-xl font-semibold tabular-nums">{services.length}</span>
          </DetailRow>
        </Card>
        <Card className="p-4">
          <DetailRow label="Total pagado">
            <span className="text-xl font-semibold tabular-nums">{money(totalPaid)}</span>
          </DetailRow>
        </Card>
        <Card className="p-4">
          <DetailRow label="Saldo pendiente">
            <span className="text-xl font-semibold tabular-nums">{money(balance)}</span>
          </DetailRow>
        </Card>
        <Card className="p-4">
          <DetailRow label="Última interacción">
            <span className="text-xl font-semibold tabular-nums">{formatDate(client.last_interaction_at)}</span>
          </DetailRow>
        </Card>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card className="flex flex-col gap-4">
          <SectionTitle>Datos del cliente</SectionTitle>
          <ActionForm action={updateClient} submitLabel="Guardar cambios">
            <input type="hidden" name="id" value={client.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre y apellido" htmlFor="full_name" className="sm:col-span-2">
                <input id="full_name" name="full_name" required minLength={2} defaultValue={client.full_name} className={fieldClass} />
              </Field>
              <Field label="WhatsApp" htmlFor="whatsapp">
                <input
                  id="whatsapp"
                  name="whatsapp"
                  inputMode="tel"
                  required
                  defaultValue={formatWhatsapp(client.whatsapp)}
                  className={fieldClass}
                />
              </Field>
              <Field label="Correo" htmlFor="email">
                <input id="email" name="email" type="email" defaultValue={client.email ?? ""} className={fieldClass} />
              </Field>
              <Field label="Notas internas" htmlFor="notes" className="sm:col-span-2">
                <textarea id="notes" name="notes" rows={3} defaultValue={client.notes ?? ""} className={`${fieldClass} py-2.5`} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="marketing_consent"
                defaultChecked={client.marketing_consent}
                className="size-4 accent-[var(--primary)]"
              />
              Acepta recibir promociones
            </label>
            <p className="text-xs text-muted-foreground">
              Consentimiento de privacidad: {client.privacy_consent_at ? formatDateTime(client.privacy_consent_at) : "no registrado"}
            </p>
          </ActionForm>
        </Card>

        <Card className="flex flex-col gap-4">
          <SectionTitle>Vehículos</SectionTitle>
          {client.vehicles.length ? (
            <ul className="flex flex-col gap-2">
              {client.vehicles.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-sm">
                  <span>{[v.brand, v.model].filter(Boolean).join(" ") || "Sin marca/modelo"}</span>
                  <Badge tone="info">{VEHICLE_CATEGORY[v.category] ?? v.category}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Sin vehículos registrados.</EmptyState>
          )}
          <ActionForm action={addVehicle} submitLabel="Agregar vehículo" resetOnSuccess className="border-t border-border pt-4">
            <input type="hidden" name="client_id" value={client.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tipo" htmlFor="category">
                <select id="category" name="category" required defaultValue="" className={fieldClass}>
                  <option value="" disabled>
                    Elegir
                  </option>
                  {Object.entries(VEHICLE_CATEGORY).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Marca" htmlFor="brand">
                <input id="brand" name="brand" className={fieldClass} />
              </Field>
              <Field label="Modelo" htmlFor="model">
                <input id="model" name="model" className={fieldClass} />
              </Field>
            </div>
          </ActionForm>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HistoryCard title="Consultas" empty="Sin consultas.">
          {inquiries.map((i) => (
            <HistoryItem key={i.id} primary={i.service} secondary={`${formatDateTime(i.created_at)} · ${i.source}`}>
              <Badge tone={inquiryTone(i.commercial_status)}>{INQUIRY_STATUS[i.commercial_status] ?? i.commercial_status}</Badge>
            </HistoryItem>
          ))}
        </HistoryCard>

        <HistoryCard title="Turnos" empty="Sin turnos.">
          {appointments.map((a) => (
            <HistoryItem
              key={a.id}
              primary={<TextLink href={`/admin/turnos/${a.id}`}>{a.service}</TextLink>}
              secondary={`${formatDateTime(a.confirmed_start ?? a.requested_start)} · ${a.address}`}
            >
              <Badge tone={appointmentTone(a.status)}>{APPOINTMENT_STATUS[a.status] ?? a.status}</Badge>
            </HistoryItem>
          ))}
        </HistoryCard>

        <HistoryCard title="Servicios realizados" empty="Sin servicios realizados.">
          {services.map((s) => (
            <HistoryItem
              key={s.id}
              primary={s.wash_type}
              secondary={`${formatDateTime(s.performed_at)} · ${money(s.final_price)} · pagado ${money(s.amount_paid)}`}
            >
              <Badge tone={paymentTone(s.payment_status)}>{PAYMENT_STATUS[s.payment_status] ?? s.payment_status}</Badge>
            </HistoryItem>
          ))}
        </HistoryCard>

        <HistoryCard title="Pagos" empty="Sin pagos registrados.">
          {payments.map((p) => (
            <HistoryItem key={p.id} primary={money(p.amount)} secondary={`${formatDate(p.paid_at)} · ${p.wash}`}>
              <Badge>{PAYMENT_METHOD[p.method] ?? p.method}</Badge>
            </HistoryItem>
          ))}
        </HistoryCard>
      </div>
    </>
  )
}

function HistoryCard({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>{title}</SectionTitle>
      {children.length ? <ul className="flex flex-col divide-y divide-border/60">{children}</ul> : <EmptyState>{empty}</EmptyState>}
    </Card>
  )
}

function HistoryItem({
  primary,
  secondary,
  children,
}: {
  primary: React.ReactNode
  secondary: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{primary}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{secondary}</span>
      </div>
      {children}
    </li>
  )
}
