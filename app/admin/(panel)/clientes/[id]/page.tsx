import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarPlus, MessageCircle } from "lucide-react"
import { addVehicle, deleteVehicle, splitInquiryToNewClient, updateClient, updateVehicle } from "@/app/admin/(panel)/crm-actions"
import { addPackage, usePackageWash } from "@/app/admin/(panel)/pro-actions"
import { ActionForm } from "@/components/admin/action-form"
import { ClientAppointmentPricing, type PricingAppointment, type PricingLine } from "@/components/admin/client-appointment-pricing"
import { ClientDangerZone } from "@/components/admin/client-danger-zone"
import { ReviewSection } from "@/components/admin/review-section"
import { Badge, Card, DetailRow, EmptyState, Field, SectionTitle, TextLink, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDate, formatDateTime, formatWhatsapp, money, whatsappLink } from "@/lib/admin/format"
import { WHATSAPP_DEFAULT_PREFIX } from "@/lib/booking"
import {
  APPOINTMENT_STATUS,
  INQUIRY_STATUS,
  PAYMENT_METHOD,
  PANEL_VEHICLE_CATEGORY,
  PAYMENT_STATUS,
  appointmentTone,
  inquiryTone,
  paymentTone,
  vehicleCategoryLabel,
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
  archived_at: string | null
  archive_reason: string | null
  vehicles: {
    id: string
    category: string
    category_label: string | null
    brand: string | null
    model: string | null
    plate: string | null
    created_at: string
  }[]
  inquiries: { id: string; created_at: string; service: string; commercial_status: string; source: string }[]
  appointments: {
    id: string
    requested_start: string | null
    confirmed_start: string | null
    service: string
    status: string
    address: string
    payment_status: string
    amount_paid: number | string
    adjusted_price: number | string | null
    agreed_price: number | string | null
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
      `id, full_name, whatsapp, email, source, notes, created_at, last_interaction_at, marketing_consent, privacy_consent_at, archived_at, archive_reason,
       vehicles(id, category, category_label, brand, model, plate, created_at),
       inquiries(id, created_at, service, commercial_status, source),
       appointments(id, requested_start, confirmed_start, service, status, address, payment_status, amount_paid, adjusted_price, agreed_price),
       services(id, performed_at, wash_type, final_price, amount_paid, payment_status, payments(id, amount, method, paid_at))`,
    )
    .eq("id", id)
    .maybeSingle()
    .returns<ClientDetail>()
  if (!client) notFound()

  const [{ data: packageRows }, { data: settings }, { data: taskRows }] = await Promise.all([
    supabase.from("client_packages").select("id, name, total_washes, used_washes, price, expires_on, created_at").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("settings").select("loyalty_every").eq("id", 1).maybeSingle(),
    supabase.from("admin_tasks").select("id, title, due_on").eq("client_id", id).is("done_at", null).order("due_on"),
  ])
  const packages = packageRows ?? []
  const loyaltyEvery = settings?.loyalty_every ?? 6

  // Turnos booked by zone have no time yet (both dates null), so the key must tolerate null.
  const byDateDesc = <T,>(list: T[], key: (x: T) => string | null) =>
    [...list].sort((a, b) => (key(b) ?? "").localeCompare(key(a) ?? ""))
  const inquiries = byDateDesc(client.inquiries, (i) => i.created_at)
  const appointments = byDateDesc(client.appointments, (a) => a.confirmed_start ?? a.requested_start)
  const openAppointments = appointments
    .filter((a) => ["solicitado", "reprogramado", "esperando_cliente", "confirmado", "realizado"].includes(a.status))
    .slice(0, 6)
  const { data: lineRows } = openAppointments.length
    ? await supabase
        .from("appointment_vehicles")
        .select("appointment_id, position, category, price_applied, needs_review, vehicle_id, vehicles(brand, model, category, category_label)")
        .in("appointment_id", openAppointments.map((a) => a.id))
        .order("position")
        .returns<PricingLine[]>()
    : { data: [] as PricingLine[] }
  const pricingAppointments: PricingAppointment[] = openAppointments.map((a) => {
    const lines = (lineRows ?? []).filter((l) => l.appointment_id === a.id)
    return {
      id: a.id,
      service: a.service,
      status: a.status,
      start: a.confirmed_start ?? a.requested_start,
      payment_status: a.payment_status,
      amount_paid: a.amount_paid,
      final_price: a.adjusted_price ?? a.agreed_price,
      lines,
    }
  })
  const services = byDateDesc(client.services, (s) => s.performed_at)
  const payments = byDateDesc(
    services.flatMap((s) => s.payments.map((p) => ({ ...p, wash: s.wash_type }))),
    (p) => p.paid_at,
  )
  const totalPaid = services.reduce((sum, s) => sum + Number(s.amount_paid), 0)
  const balance = services.reduce((sum, s) => sum + Number(s.final_price) - Number(s.amount_paid), 0)
  const loyaltyProgress = services.length % loyaltyEvery
  const nextIsFree = loyaltyProgress === loyaltyEvery - 1

  const timeline = [
    ...inquiries.map((i) => ({ at: i.created_at, label: "Consulta", text: i.service, href: undefined as string | undefined })),
    ...appointments
      .filter((a) => a.confirmed_start ?? a.requested_start)
      .map((a) => ({ at: (a.confirmed_start ?? a.requested_start)!, label: "Turno", text: `${a.service} · ${APPOINTMENT_STATUS[a.status] ?? a.status}`, href: `/admin/turnos/${a.id}` })),
    ...services.map((s) => ({ at: s.performed_at, label: "Lavado", text: `${s.wash_type} · ${money(s.final_price)}`, href: undefined })),
    ...payments.map((p) => ({ at: p.paid_at, label: "Pago", text: `${money(p.amount)} · ${PAYMENT_METHOD[p.method] ?? p.method}`, href: undefined })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link href="/admin/clientes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> Clientes
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{client.full_name}</h1>
              {client.archived_at && <Badge tone="warning">Archivado</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Cliente desde {formatDate(client.created_at)} · Origen: {client.source}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/turnos/nuevo?cliente=${client.id}`} className={secondaryButtonClass}>
              <CalendarPlus className="size-4" aria-hidden="true" />
              Nuevo turno
            </Link>
            <a href={whatsappLink(client.whatsapp)} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
              <MessageCircle className="size-4 text-whatsapp" aria-hidden="true" />
              Escribir por WhatsApp
            </a>
          </div>
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
              {client.vehicles.map((v) => {
                const name = [v.brand, v.model].filter(Boolean).join(" ") || "Sin marca/modelo"
                return (
                  <li key={v.id} className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        {name}
                        {v.plate && <span className="ml-2 font-mono text-xs text-muted-foreground">{v.plate}</span>}
                      </span>
                      <Badge tone="info">{vehicleCategoryLabel(v.category, v.category_label)}</Badge>
                    </div>
                    <details className="rounded-xl border border-border px-3 py-1.5">
                      <summary className="cursor-pointer py-1 text-muted-foreground hover:text-foreground">Editar o eliminar</summary>
                      <ActionForm action={updateVehicle} submitLabel="Guardar vehículo" submitClassName={secondaryButtonClass} className="gap-3 pt-3">
                        <input type="hidden" name="vehicle_id" value={v.id} />
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Tipo" htmlFor={`cat-${v.id}`}>
                            <select id={`cat-${v.id}`} name="category" defaultValue={v.category} className={fieldClass}>
                              {Object.entries(PANEL_VEHICLE_CATEGORY).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Si es Otro, ¿cuál?" htmlFor={`label-${v.id}`}>
                            <input id={`label-${v.id}`} name="category_label" maxLength={40} placeholder="Moto, Cuatriciclo…" defaultValue={v.category_label ?? ""} className={fieldClass} />
                          </Field>
                          <Field label="Marca" htmlFor={`brand-${v.id}`}>
                            <input id={`brand-${v.id}`} name="brand" maxLength={60} defaultValue={v.brand ?? ""} className={fieldClass} />
                          </Field>
                          <Field label="Modelo" htmlFor={`model-${v.id}`}>
                            <input id={`model-${v.id}`} name="model" maxLength={60} defaultValue={v.model ?? ""} className={fieldClass} />
                          </Field>
                          <Field label="Patente" htmlFor={`plate-${v.id}`} className="col-span-2">
                            <input id={`plate-${v.id}`} name="plate" maxLength={12} defaultValue={v.plate ?? ""} placeholder="AB123CD" className={`${fieldClass} uppercase`} />
                          </Field>
                        </div>
                      </ActionForm>
                      <ActionForm
                        action={deleteVehicle}
                        submitLabel="Eliminar vehículo"
                        submitClassName={`${secondaryButtonClass} text-red-200`}
                        confirmText={`¿Eliminar ${name}? También se quita de sus turnos y se recalculan los totales.`}
                        className="border-t border-border py-3"
                      >
                        <input type="hidden" name="vehicle_id" value={v.id} />
                      </ActionForm>
                    </details>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState>Sin vehículos registrados.</EmptyState>
          )}
          <ActionForm action={addVehicle} submitLabel="Agregar vehículo" resetOnSuccess className="border-t border-border pt-4">
            <input type="hidden" name="client_id" value={client.id} />
            <p className="text-sm font-medium">Agregar otro vehículo (auto, moto, cuatriciclo���)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo" htmlFor="category">
                <select id="category" name="category" required defaultValue="" className={fieldClass}>
                  <option value="" disabled>
                    Elegir
                  </option>
                  {Object.entries(PANEL_VEHICLE_CATEGORY).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Si es Otro, ¿cuál?" htmlFor="category_label">
                <input id="category_label" name="category_label" maxLength={40} placeholder="Moto, Cuatriciclo…" className={fieldClass} />
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

      <section id="precios" className="scroll-mt-24">
        <Card className="flex flex-col gap-4">
          <SectionTitle>Precios y cobro por turno</SectionTitle>
          <p className="text-sm text-muted-foreground text-pretty">
            Cargá el precio del trabajo de cada vehículo, quitá los que se agregaron de más y confirmá el pago cuando el turno esté realizado.
          </p>
          <ClientAppointmentPricing clientId={client.id} appointments={pricingAppointments} vehicles={client.vehicles} />
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <SectionTitle aside={nextIsFree && <Badge tone="success">Próximo gratis</Badge>}>Fidelidad</SectionTitle>
          <p className="text-sm text-muted-foreground">
            {loyaltyProgress} de {loyaltyEvery} lavados. Cada {loyaltyEvery}, uno gratis.
          </p>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: loyaltyEvery }, (_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < loyaltyProgress ? "bg-electric" : "bg-surface"}`} />
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionTitle>Abonos</SectionTitle>
          {packages.length === 0 ? (
            <EmptyState>Sin abonos.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {packages.map((p) => {
                const left = p.total_washes - p.used_washes
                return (
                  <li key={p.id} className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge tone={left > 0 ? "success" : "neutral"}>
                        Quedan {left} de {p.total_washes}
                      </Badge>
                    </div>
                    {p.expires_on && <span className="text-xs text-muted-foreground">Vence {formatDate(p.expires_on)}</span>}
                    <div className="flex flex-wrap gap-2">
                      <ActionForm action={usePackageWash} submitLabel="Usar un lavado" submitClassName={secondaryButtonClass}>
                        <input type="hidden" name="package_id" value={p.id} />
                        <input type="hidden" name="delta" value="1" />
                      </ActionForm>
                      {p.used_washes > 0 && (
                        <ActionForm action={usePackageWash} submitLabel="Deshacer" submitClassName={secondaryButtonClass}>
                          <input type="hidden" name="package_id" value={p.id} />
                          <input type="hidden" name="delta" value="-1" />
                        </ActionForm>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <details className="rounded-2xl border border-border px-4 py-2 text-sm">
            <summary className="cursor-pointer py-1 text-muted-foreground hover:text-foreground">Nuevo abono</summary>
            <ActionForm action={addPackage} submitLabel="Crear abono" resetOnSuccess className="pt-3">
              <input type="hidden" name="client_id" value={client.id} />
              <Field label="Nombre" htmlFor="pkg-name">
                <input id="pkg-name" name="name" required maxLength={80} placeholder="4 lavados por mes" className={fieldClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lavados" htmlFor="pkg-total">
                  <input id="pkg-total" name="total_washes" type="number" min={1} max={100} required defaultValue={4} className={fieldClass} />
                </Field>
                <Field label="Precio" htmlFor="pkg-price">
                  <input id="pkg-price" name="price" inputMode="decimal" className={fieldClass} />
                </Field>
              </div>
              <Field label="Vence (opcional)" htmlFor="pkg-exp">
                <input id="pkg-exp" name="expires_on" type="date" className={fieldClass} />
              </Field>
            </ActionForm>
          </details>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionTitle aside={<TextLink href={`/admin/tareas?cliente=${client.id}`}>Nueva</TextLink>}>Tareas</SectionTitle>
          {(taskRows ?? []).length === 0 ? (
            <EmptyState>Sin tareas pendientes.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {(taskRows ?? []).map((t) => (
                <li key={t.id} className="flex justify-between gap-2 rounded-2xl bg-surface px-4 py-3">
                  <span>{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(t.due_on)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <SectionTitle>Línea de tiempo</SectionTitle>
        {timeline.length === 0 ? (
          <EmptyState>Todavía no hay actividad.</EmptyState>
        ) : (
          <ol className="flex flex-col border-l border-border pl-4">
            {timeline.slice(0, 60).map((e, i) => (
              <li key={i} className="relative py-2 text-sm">
                <span className="absolute -left-[21px] top-3.5 size-2.5 rounded-full bg-electric" aria-hidden="true" />
                <p>
                  <span className="font-medium">{e.label}</span> ·{" "}
                  {e.href ? <TextLink href={e.href}>{e.text}</TextLink> : e.text}
                </p>
                <time className="text-xs tabular-nums text-muted-foreground">{formatDateTime(e.at)}</time>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <HistoryCard title="Consultas" empty="Sin consultas.">
          {inquiries.map((i) => (
            <HistoryItem
              key={i.id}
              primary={i.service}
              secondary={`${formatDateTime(i.created_at)} · ${i.source}`}
              extra={
                inquiries.length > 1 ? (
                  <details className="group mt-2 rounded-2xl bg-surface px-4 py-2 text-sm">
                    <summary className="cursor-pointer select-none py-1 text-muted-foreground hover:text-foreground">
                      Es otra persona: separar en otro cliente
                    </summary>
                    <ActionForm
                      action={splitInquiryToNewClient}
                      submitLabel="Separar en cliente nuevo"
                      submitClassName={secondaryButtonClass}
                      confirmText="Se creará un cliente nuevo con esta consulta, sus turnos, servicios y su vehículo. ¿Continuar?"
                      className="pt-3 pb-2"
                    >
                      <input type="hidden" name="inquiry_id" value={i.id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Nombre y apellido" htmlFor={`split-name-${i.id}`}>
                          <input id={`split-name-${i.id}`} name="full_name" required minLength={2} className={fieldClass} />
                        </Field>
                        <Field label="WhatsApp (distinto)" htmlFor={`split-wa-${i.id}`}>
                          <input id={`split-wa-${i.id}`} name="whatsapp" type="tel" inputMode="tel" required defaultValue={WHATSAPP_DEFAULT_PREFIX} className={fieldClass} />
                        </Field>
                      </div>
                    </ActionForm>
                  </details>
                ) : null
              }
            >
              <Badge tone={inquiryTone(i.commercial_status)}>{INQUIRY_STATUS[i.commercial_status] ?? i.commercial_status}</Badge>
            </HistoryItem>
          ))}
        </HistoryCard>

        <HistoryCard title="Turnos" empty="Sin turnos.">
          {appointments.map((a) => (
            <HistoryItem
              key={a.id}
              primary={<TextLink href={`/admin/turnos/${a.id}`}>{a.service}</TextLink>}
              secondary={`${a.confirmed_start ?? a.requested_start ? formatDateTime(a.confirmed_start ?? a.requested_start) : "Sin horario"} · ${a.address}`}
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

      <ReviewSection supabase={supabase} clientId={client.id} />

      <ClientDangerZone supabase={supabase} client={client} />
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
  extra,
}: {
  primary: React.ReactNode
  secondary: string
  children: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <li className="flex flex-col py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{primary}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{secondary}</span>
        </div>
        {children}
      </div>
      {extra}
    </li>
  )
}
