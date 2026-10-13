"use client"

import Link from "next/link"
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react"
import { ArrowRight, CheckCircle2, ChevronDown, Loader2 } from "lucide-react"
import { submitBooking } from "@/app/actions/booking"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"
import { VehicleLineIcon } from "@/components/vehicle-line-icon"
import { WhatsAppIcon } from "@/components/whatsapp-icon"
import { EXTRAS, SERVICE_DAYS, TIME_SLOTS, VEHICLES, formatARS, whatsappUrl } from "@/lib/site"
import { cn } from "@/lib/utils"

const fieldClass =
  "min-h-14 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10"

function todayISO() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
}

function isSunday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).getDay() === 0
}

export function Booking() {
  const [vehicle, setVehicle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [whatsappMessage, setWhatsappMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const startedAt = useRef(0)
  const selected = VEHICLES.find((v) => v.id === vehicle)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const name = String(data.get("name") ?? "").trim()
    const phone = String(data.get("phone") ?? "").trim()
    const address = String(data.get("address") ?? "").trim()
    const date = String(data.get("date") ?? "")
    const time = String(data.get("time") ?? "")
    const brand = String(data.get("brand") ?? "").trim()
    const model = String(data.get("model") ?? "").trim()
    const notes = String(data.get("notes") ?? "").trim()
    const noWater = Boolean(data.get("noWater"))
    const extras = data
      .getAll("extras")
      .map((id) => EXTRAS.find((x) => x.id === id)?.name)
      .filter(Boolean)

    if (!name || !selected || !address || !phone || !date || !time) {
      setError("Completá todos los campos obligatorios para reservar.")
      return
    }
    if (isSunday(date)) {
      setError(`Trabajamos de ${SERVICE_DAYS.full.toLowerCase()}. Elegí otro día.`)
      return
    }
    if (!data.get("privacy")) {
      setError("Necesitamos tu consentimiento para gestionar la reserva.")
      return
    }
    setError(null)

    const params = new URLSearchParams(window.location.search)
    data.set("startedAt", String(startedAt.current))
    data.set("utmSource", params.get("utm_source") ?? "")
    data.set("ref", params.get("ref") ?? "")
    data.set("referrer", document.referrer)

    const message = [
      "Hola MK Cars, envié una solicitud de turno desde la web.",
      "",
      `Nombre: ${name}`,
      `Vehículo: ${selected.name}${brand || model ? ` (${[brand, model].filter(Boolean).join(" ")})` : ""}`,
      `Agua: ${noWater ? "Sin agua en el domicilio" : "Agua del domicilio"}`,
      ...(extras.length ? [`Lavado en detalle: ${extras.join(", ")}`] : []),
      `Dirección: ${address}`,
      `Fecha preferida: ${formatDate(date)} · ${time} hs`,
      ...(notes ? [`Observaciones: ${notes}`] : []),
    ].join("\n")

    startTransition(async () => {
      try {
        const result = await submitBooking(data)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setWhatsappMessage(message)
        form.reset()
        setVehicle("")
      } catch {
        setError("No pudimos guardar tu solicitud. Revisá tu conexión y volvé a intentar.")
      }
    })
  }

  return (
    <section id="reservar" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-28">
      <div className="flex flex-col gap-8 md:gap-10">
        <SectionHeading
          eyebrow="Reserva"
          title="Reservá en un minuto."
          description="Te confirmamos por WhatsApp."
        />

        <Reveal>
          {whatsappMessage ? (
            <div
              role="status"
              className="flex flex-col gap-5 rounded-[2rem] border border-border bg-card p-6 shadow-soft sm:p-8"
            >
              <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-tight">Solicitud recibida</h3>
                <p className="leading-relaxed text-muted-foreground">
                  Recibimos tu solicitud de turno. MK Cars verificará la disponibilidad y te confirmará por WhatsApp.
                </p>
              </div>
              <a
                href={whatsappUrl(whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground shadow-glow transition-transform active:scale-[0.98]"
              >
                <WhatsAppIcon className="size-5" />
                Continuar por WhatsApp
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => setWhatsappMessage(null)}
                className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Enviar otra solicitud
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              onFocusCapture={() => {
                if (!startedAt.current) startedAt.current = Date.now()
              }}
              noValidate
              className="flex flex-col gap-8 rounded-[2rem] border border-border bg-card p-5 shadow-soft sm:p-8"
            >
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="website">No completar</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              <div className="flex flex-col gap-5">
                <SectionLabel>Datos para tu turno</SectionLabel>
                <div className="grid gap-5 md:grid-cols-2 md:gap-x-6">
                  <Field label="Nombre y apellido" htmlFor="name" required>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Tu nombre y apellido"
                      className={fieldClass}
                      required
                    />
                  </Field>

                  <fieldset className="flex min-w-0 flex-col gap-2 md:row-span-1">
                    <legend className="mb-2 text-sm font-medium text-white">
                      Tipo de vehículo
                      <span className="text-primary" aria-hidden="true">
                        {" *"}
                      </span>
                    </legend>
                    <div className="grid grid-cols-3 gap-2">
                      {VEHICLES.map((v) => {
                        const checked = vehicle === v.id
                        return (
                          <label
                            key={v.id}
                            className={cn(
                              "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20",
                              checked
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-surface text-white/80 hover:border-white/30",
                            )}
                          >
                            <input
                              type="radio"
                              name="vehicle"
                              value={v.id}
                              checked={checked}
                              onChange={() => setVehicle(v.id)}
                              className="sr-only"
                              required
                            />
                            <span className="flex h-6 items-center">
                              <VehicleLineIcon id={v.id} width={v.id === "pickup" ? 64 : 52} />
                            </span>
                            <span className="sr-only">{v.name}, desde</span>
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                checked ? "text-primary" : "text-white",
                              )}
                            >
                              {formatARS(v.price)}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>

                  <Field label="Dirección" htmlFor="address" required>
                    <input
                      id="address"
                      name="address"
                      type="text"
                      autoComplete="street-address"
                      placeholder="Calle, número y departamento"
                      className={fieldClass}
                      required
                    />
                  </Field>

                  <Field label="WhatsApp" htmlFor="phone" required>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="261 000-0000"
                      className={fieldClass}
                      required
                    />
                  </Field>

                  <Field label="Fecha" htmlFor="date" required>
                    <input
                      id="date"
                      name="date"
                      type="date"
                      min={todayISO()}
                      className={cn(fieldClass, "pr-2")}
                      required
                    />
                  </Field>

                  <Field label="Horario" htmlFor="time" required>
                    <SelectWrap>
                      <select
                        id="time"
                        name="time"
                        defaultValue=""
                        className={cn(fieldClass, "appearance-none pr-10")}
                        required
                      >
                        <option value="" disabled>
                          Hora
                        </option>
                        {TIME_SLOTS.map((t) => (
                          <option key={t} value={t}>
                            {t} hs
                          </option>
                        ))}
                      </select>
                    </SelectWrap>
                  </Field>
                </div>
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 text-sm font-medium text-white">Lavado en detalle</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {EXTRAS.map((extra) => (
                    <label
                      key={extra.id}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface px-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-sky has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40"
                    >
                      <input type="checkbox" name="extras" value={extra.id} className="size-5 accent-primary" />
                      <span className="flex-1 text-sm font-medium text-white">{extra.name}</span>
                      <span className="text-xs text-muted-foreground">Consultar</span>
                    </label>
                  ))}
                </div>
                <label className="mt-1 flex cursor-pointer items-start gap-3 px-1">
                  <input type="checkbox" name="noWater" className="mt-0.5 size-4 accent-primary" />
                  <span className="flex flex-col">
                    <span className="text-sm text-white">No tengo agua en el domicilio</span>
                    <span className="text-xs text-muted-foreground">MK puede llevarte agua.</span>
                  </span>
                </label>
              </fieldset>

              <div className="flex flex-col gap-5 border-t border-border pt-6">
                <SectionLabel muted>Datos opcionales</SectionLabel>
                <div className="grid gap-5 md:grid-cols-3 md:gap-x-6">
                  <Field label="Correo electrónico" htmlFor="email">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="tu@correo.com"
                      className={fieldClass}
                    />
                  </Field>
                  <Field label="Marca del vehículo" htmlFor="brand">
                    <input id="brand" name="brand" type="text" placeholder="Ej: Toyota" className={fieldClass} />
                  </Field>
                  <Field label="Modelo del vehículo" htmlFor="model">
                    <input id="model" name="model" type="text" placeholder="Ej: Hilux" className={fieldClass} />
                  </Field>
                </div>
                <Field label="Observaciones" htmlFor="notes">
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    maxLength={1000}
                    placeholder="Indicaciones de acceso, estado del vehículo, etc."
                    className={cn(fieldClass, "min-h-20 resize-y py-3")}
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-3 px-1">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name="privacy" required className="mt-0.5 size-4 shrink-0 accent-primary" />
                  <span className="text-sm text-muted-foreground">
                    Acepto que MK Cars use mis datos para gestionar esta reserva, según la{" "}
                    <Link href="/privacidad" className="text-foreground underline underline-offset-2">
                      política de privacidad
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name="marketing" className="mt-0.5 size-4 shrink-0 accent-primary" />
                  <span className="text-sm text-muted-foreground">
                    Quiero recibir promociones y recordatorios (opcional).
                  </span>
                </label>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-sky px-4 py-3 text-sm text-white">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-70"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    Enviando solicitud
                  </>
                ) : (
                  <>
                    Solicitar turno
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  )
}

function SectionLabel({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <p className={cn("text-xs font-medium uppercase tracking-wider", muted ? "text-muted-foreground" : "text-primary")}>
      {children}
    </p>
  )
}

function Field({
  label,
  htmlFor,
  required,
  className,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className={cn("text-sm", required ? "font-medium text-white" : "text-muted-foreground")}
      >
        {label}
        {required && (
          <span className="text-primary" aria-hidden="true">
            {" *"}
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}
