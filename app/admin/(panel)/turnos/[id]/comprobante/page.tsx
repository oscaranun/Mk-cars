import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, MessageCircle } from "lucide-react"
import { requireAdmin } from "@/lib/admin/auth"
import { AppointmentPhotos } from "@/components/admin/appointment-photos"
import { PrintButton } from "@/components/admin/print-button"
import { Card, secondaryButtonClass } from "@/components/admin/ui"
import { formatDate, formatDateTime, money, whatsappLink } from "@/lib/admin/format"
import { PAYMENT_METHOD, VEHICLE_CATEGORY } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Comprobante" }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Appt = {
  id: string
  service: string | null
  extras: string[] | null
  address: string | null
  confirmed_start: string | null
  requested_start: string | null
  agreed_price: number | null
  discount: number | null
  amount_paid: number
  contact_name: string | null
  clients: { full_name: string | null; whatsapp: string | null } | null
  vehicles: { brand: string | null; model: string | null; category: string | null; plate: string | null } | null
  payments: { amount: number; method: string | null; paid_at: string; voided_at: string | null }[]
}

export default async function ComprobantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("appointments")
    .select(
      "id, service, extras, address, confirmed_start, requested_start, agreed_price, discount, amount_paid, contact_name, clients(full_name, whatsapp), vehicles(brand, model, category, plate), payments(amount, method, paid_at, voided_at)",
    )
    .eq("id", id)
    .maybeSingle()
  if (!data) notFound()
  const a = data as unknown as Appt

  const name = a.contact_name || a.clients?.full_name || "Cliente"
  const price = Number(a.agreed_price ?? 0)
  const discount = Number(a.discount ?? 0)
  const total = Math.max(0, price - discount)
  const payments = (a.payments ?? []).filter((p) => !p.voided_at)
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const balance = Math.max(0, total - paid)
  const vehicle = a.vehicles
    ? [a.vehicles.category && VEHICLE_CATEGORY[a.vehicles.category], a.vehicles.brand, a.vehicles.model, a.vehicles.plate].filter(Boolean).join(" · ")
    : ""
  const when = a.confirmed_start ?? a.requested_start
  const number = a.id.slice(0, 8).toUpperCase()

  const message = [
    `Hola ${name}! Te dejamos el comprobante de tu lavado en MK Car Wash Premium:`,
    `Comprobante N° ${number}`,
    a.service && `Servicio: ${a.service}`,
    vehicle && `Vehículo: ${vehicle}`,
    when && `Fecha: ${formatDate(when)}`,
    `Total: ${money(total)}`,
    `Pagado: ${money(paid)}`,
    balance > 0 ? `Saldo pendiente: ${money(balance)}` : "¡Gracias por tu pago!",
  ]
    .filter(Boolean)
    .join("\n")

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/turnos/${a.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al turno
        </Link>
        <div className="flex flex-wrap gap-2">
          {a.clients?.whatsapp && (
            <a href={`${whatsappLink(a.clients.whatsapp)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
              <MessageCircle className="size-4 text-emerald-400" aria-hidden="true" />
              Enviar por WhatsApp
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      <Card className="mx-auto flex w-full max-w-2xl flex-col gap-6 print:border-0 print:bg-white print:text-black print:shadow-none">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold tracking-tight">MK Car Wash Premium</p>
            <p className="text-sm text-muted-foreground print:text-neutral-600">Lavado a domicilio · Mendoza</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Comprobante N° {number}</p>
            <p className="text-muted-foreground print:text-neutral-600">{formatDate(new Date())}</p>
          </div>
        </header>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground print:text-neutral-600">Cliente</dt>
            <dd className="font-medium">{name}</dd>
          </div>
          {when && (
            <div>
              <dt className="text-muted-foreground print:text-neutral-600">Fecha del servicio</dt>
              <dd className="font-medium">{formatDateTime(when)}</dd>
            </div>
          )}
          {vehicle && (
            <div>
              <dt className="text-muted-foreground print:text-neutral-600">Vehículo</dt>
              <dd className="font-medium">{vehicle}</dd>
            </div>
          )}
          {a.address && (
            <div>
              <dt className="text-muted-foreground print:text-neutral-600">Dirección</dt>
              <dd className="font-medium">{a.address}</dd>
            </div>
          )}
        </dl>

        <table className="w-full text-sm">
          <caption className="sr-only">Detalle del comprobante</caption>
          <tbody className="divide-y divide-border print:divide-neutral-300">
            <tr>
              <th scope="row" className="py-2 text-left font-normal">
                {a.service ?? "Servicio"}
                {a.extras && a.extras.length > 0 && <span className="block text-xs text-muted-foreground">Extras: {a.extras.join(", ")}</span>}
              </th>
              <td className="py-2 text-right tabular-nums">{money(price)}</td>
            </tr>
            {discount > 0 && (
              <tr>
                <th scope="row" className="py-2 text-left font-normal">Descuento</th>
                <td className="py-2 text-right tabular-nums">-{money(discount)}</td>
              </tr>
            )}
            <tr>
              <th scope="row" className="py-2 text-left font-semibold">Total</th>
              <td className="py-2 text-right font-semibold tabular-nums">{money(total)}</td>
            </tr>
            {payments.map((p, i) => (
              <tr key={i}>
                <th scope="row" className="py-2 text-left font-normal">
                  Pago {PAYMENT_METHOD[p.method ?? "otro"] ?? p.method} · {formatDate(p.paid_at)}
                </th>
                <td className="py-2 text-right tabular-nums">{money(p.amount)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2 text-left font-semibold">{balance > 0 ? "Saldo pendiente" : "Pagado en su totalidad"}</th>
              <td className="py-2 text-right font-semibold tabular-nums">{money(balance)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-center text-xs text-muted-foreground print:text-neutral-600">Gracias por elegirnos.</p>
      </Card>

      <AppointmentPhotos supabase={supabase} appointmentId={a.id} />
    </>
  )
}
