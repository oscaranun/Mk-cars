"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarCheck, CheckCircle2, Clock, Copy, Loader2, MapPin } from "lucide-react"
import { respondToOffer } from "@/app/actions/offer"
import { cn } from "@/lib/utils"

export type PublicOffer = {
  version: number
  status: string
  appointment_status: string
  client_first_name: string | null
  address: string
  service: string
  extras: string[] | null
  vehicles: string[]
  total: number
  discount: number
  final: number
  conditions: string | null
  slots: { start: string; duration: number; available: boolean }[]
  accepted_start: string | null
  duration: number
  payment: { alias: string | null; holder: string | null; bank: string | null; paid: number; status: string } | null
}

const TZ = "America/Argentina/Buenos_Aires"
const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
const day = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })
const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })

export function OfferResponseForm({ token, offer }: { token: string; offer: PublicOffer }) {
  const router = useRouter()
  const firstAvailable = offer.slots.find((s) => s.available)?.start ?? null
  const [selected, setSelected] = useState<string | null>(offer.slots.length === 1 ? firstAvailable : null)
  const [message, setMessage] = useState("")
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const accepted = offer.status === "aceptada" && offer.appointment_status === "confirmado"
  const open = offer.status !== "aceptada" && offer.appointment_status === "esperando_cliente"

  function send(action: "aceptar" | "pide_alternativas" | "mas_adelante") {
    if (action === "aceptar" && !selected) {
      setResult({ ok: false, message: "Elegí uno de los horarios." })
      return
    }
    startTransition(async () => {
      const res = await respondToOffer(token, action, offer.version, selected, message)
      setResult(res)
      if (res.ok || res.message.includes("Recargá")) router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {accepted ? "Tu turno está confirmado" : `Hola${offer.client_first_name ? ` ${offer.client_first_name}` : ""}, esta es tu propuesta`}
        </h1>
        {!accepted && open && <p className="text-muted-foreground text-pretty">Elegí el horario que te quede mejor y aceptá la propuesta.</p>}
      </div>

      <section aria-label="Detalle del servicio" className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5">
        <p className="font-medium">{offer.service}</p>
        {offer.extras && offer.extras.length > 0 && <p className="text-sm text-muted-foreground">{`Incluye: ${offer.extras.join(", ")}`}</p>}
        {offer.vehicles.length > 0 && <p className="text-sm text-muted-foreground">{offer.vehicles.join(" · ")}</p>}
        <p className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {offer.address}
        </p>
        <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="flex flex-col items-end tabular-nums">
            {offer.discount > 0 && (
              <span className="text-sm text-muted-foreground">
                <s>{money(offer.total)}</s>
                {` · ahorrás ${money(offer.discount)}`}
              </span>
            )}
            <span className="text-2xl font-semibold">{money(offer.final)}</span>
          </span>
        </div>
        {offer.conditions && <p className="whitespace-pre-wrap rounded-2xl bg-surface p-3 text-sm text-pretty">{offer.conditions}</p>}
      </section>

      {accepted && offer.accepted_start && (
        <>
          <div role="status" className="flex items-start gap-3 rounded-3xl bg-primary/10 p-5">
            <CalendarCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="font-semibold capitalize">{day(offer.accepted_start)}</span>
              <span className="tabular-nums">{`${hour(offer.accepted_start)} hs · ${offer.duration} min aprox.`}</span>
            </div>
          </div>
          <PaymentInfo offer={offer} />
        </>
      )}

      {open && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-medium">Horarios disponibles</legend>
          {offer.slots.map((slot) => {
            const checked = selected === slot.start
            return (
              <label
                key={slot.start}
                className={cn(
                  "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-4 transition-colors",
                  checked && "border-primary bg-primary/10",
                  !slot.available && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="slot"
                  value={slot.start}
                  checked={checked}
                  disabled={!slot.available || pending}
                  onChange={() => setSelected(slot.start)}
                  className="size-5 accent-primary"
                />
                <span className="flex flex-1 flex-col">
                  <span className="font-medium capitalize">{day(slot.start)}</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {slot.available ? `${hour(slot.start)} hs · ${slot.duration} min` : `${hour(slot.start)} hs · ya no está disponible`}
                  </span>
                </span>
              </label>
            )
          })}
          <label htmlFor="offer-message" className="mt-2 text-sm text-muted-foreground">
            Mensaje para MK Cars (opcional)
          </label>
          <textarea
            id="offer-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          <button
            type="button"
            onClick={() => send("aceptar")}
            disabled={pending || !firstAvailable}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
            Aceptar y confirmar turno
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => send("pide_alternativas")}
              disabled={pending}
              className="min-h-12 rounded-full border border-border px-3 text-sm font-medium disabled:opacity-60"
            >
              Pedir otros horarios
            </button>
            <button
              type="button"
              onClick={() => send("mas_adelante")}
              disabled={pending}
              className="min-h-12 rounded-full border border-border px-3 text-sm font-medium disabled:opacity-60"
            >
              Más adelante
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-pretty">
            El pago se realiza por transferencia una vez confirmado el turno. No transfieras antes de aceptar.
          </p>
        </fieldset>
      )}

      {!open && !accepted && (
        <p role="status" className="rounded-3xl bg-surface p-5 text-pretty">
          {offer.status === "pide_alternativas"
            ? "Recibimos tu pedido. MK Cars te va a enviar otros horarios por WhatsApp a este mismo enlace."
            : offer.status === "mas_adelante"
              ? "Anotamos que preferís coordinar más adelante. Cuando quieras, escribinos por WhatsApp."
              : "Esta propuesta ya no está disponible. Escribinos por WhatsApp y lo coordinamos."}
        </p>
      )}

      {result && (
        <p role={result.ok ? "status" : "alert"} className={cn("flex items-start gap-2 rounded-2xl p-4 text-sm", result.ok ? "bg-emerald-500/10" : "bg-destructive/10 text-destructive")}>
          {result.ok && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />}
          {result.message}
        </p>
      )}
    </div>
  )
}

function PaymentInfo({ offer }: { offer: PublicOffer }) {
  const [copied, setCopied] = useState(false)
  const p = offer.payment
  if (!p) return null
  if (p.status === "pagado") {
    return <p className="rounded-3xl bg-emerald-500/10 p-5 text-sm">Pago recibido. ¡Gracias!</p>
  }
  const balance = Math.max(0, offer.final - p.paid)
  return (
    <section aria-label="Datos para pagar" className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5">
      <h2 className="font-semibold">Pago por transferencia</h2>
      {p.alias ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-3">
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">Alias</span>
              <span className="font-mono text-base font-medium break-all">{p.alias}</span>
            </span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(p.alias!).catch(() => null)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-sm"
            >
              <Copy className="size-4" aria-hidden="true" />
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          {(p.holder || p.bank) && <p className="text-sm text-muted-foreground">{[p.holder, p.bank].filter(Boolean).join(" · ")}</p>}
          <p className="text-sm tabular-nums">{`Importe a transferir: ${money(balance)}`}</p>
          <p className="text-xs text-muted-foreground text-pretty">Enviá el comprobante por WhatsApp. MK Cars registra el pago cuando lo verifica.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">MK Cars te enviará los datos de transferencia por WhatsApp.</p>
      )}
    </section>
  )
}
