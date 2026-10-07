"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import { ArrowRight, ChevronDown } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"
import { WhatsAppIcon } from "@/components/whatsapp-icon"
import {
  EXTRAS,
  SERVICES,
  SERVICE_DAYS,
  SERVICE_HOURS,
  TIME_SLOTS,
  VEHICLES,
  formatARS,
  whatsappUrl,
  type VehicleId,
} from "@/lib/site"
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
  const [vehicle, setVehicle] = useState<VehicleId>("auto")
  const [error, setError] = useState<string | null>(null)
  const selected = VEHICLES.find((v) => v.id === vehicle)!

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = String(data.get("name") ?? "").trim()
    const phone = String(data.get("phone") ?? "").trim()
    const waterId = data.get("noWater") ? "agua-propia" : "agua-domicilio"
    const service = SERVICES.find((s) => s.id === waterId)
    const address = String(data.get("address") ?? "").trim()
    const date = String(data.get("date") ?? "")
    const time = String(data.get("time") ?? "")
    const extras = data
      .getAll("extras")
      .map((id) => EXTRAS.find((e) => e.id === id)?.name)
      .filter(Boolean)

    if (!name || !phone || !service || !address || !date || !time) {
      setError("Completá todos los campos para reservar.")
      return
    }
    if (isSunday(date)) {
      setError(`Trabajamos de ${SERVICE_DAYS.full.toLowerCase()}. Elegí otro día.`)
      return
    }
    setError(null)

    const message = [
      "Hola MK Cars, quiero reservar un lavado a domicilio.",
      "",
      `Nombre: ${name}`,
      `WhatsApp: ${phone}`,
      `Vehículo: ${selected.name} (desde ${formatARS(selected.price)})`,
      `Servicio: ${service.name}`,
      ...(extras.length ? [`Adicionales: ${extras.join(", ")} (consultar precio)`] : []),
      `Dirección: ${address}`,
      `Fecha: ${formatDate(date)}`,
      `Horario: ${time} hs`,
    ].join("\n")

    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer")
  }

  return (
    <section id="reservar" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-28">
      <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:gap-16">
        <div className="flex flex-col gap-8">
          <SectionHeading
            eyebrow="Reserva"
            title="Reservá en un minuto."
            description="Te confirmamos por WhatsApp."
          />
          <Reveal>
            <dl className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-card shadow-soft">
              <div className="flex items-center justify-between gap-4 p-5">
                <dt className="text-sm text-muted-foreground">Días</dt>
                <dd className="font-medium">{SERVICE_DAYS.full}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 p-5">
                <dt className="text-sm text-muted-foreground">Horario</dt>
                <dd className="font-medium tabular-nums">
                  {SERVICE_HOURS.open} – {SERVICE_HOURS.close}
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>

        <Reveal>
          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-5 rounded-[2rem] border border-border bg-card p-5 shadow-soft sm:p-8"
          >
            <Field label="Nombre" htmlFor="name">
              <input id="name" name="name" type="text" autoComplete="name" placeholder="Tu nombre" className={fieldClass} required />
            </Field>

            <Field label="WhatsApp" htmlFor="phone">
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

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm text-muted-foreground">Tipo de vehículo</legend>
              <div className="grid grid-cols-3 gap-2">
                {VEHICLES.map((v) => (
                  <label
                    key={v.id}
                    className={cn(
                      "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40",
                      vehicle === v.id
                        ? "border-primary bg-primary text-primary-foreground shadow-glow"
                        : "border-border bg-surface text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="vehicle"
                      value={v.id}
                      checked={vehicle === v.id}
                      onChange={() => setVehicle(v.id)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{v.name}</span>
                    <span className={cn("text-xs tabular-nums", vehicle === v.id ? "text-white/75" : "text-muted-foreground")}>
                      {formatARS(v.price)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 px-1">
              <input type="checkbox" name="noWater" className="mt-0.5 size-4 accent-primary" />
              <span className="flex flex-col">
                <span className="text-sm text-muted-foreground">No tengo acceso a agua en el domicilio</span>
                <span className="text-xs text-muted-foreground/80">MK puede llevarte agua.</span>
              </span>
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm text-muted-foreground">Adicionales (opcional)</legend>
              <div className="flex flex-col gap-2">
                {EXTRAS.map((extra) => (
                  <label
                    key={extra.id}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface px-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-sky has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40"
                  >
                    <input type="checkbox" name="extras" value={extra.id} className="size-5 accent-primary" />
                    <span className="flex-1 text-sm font-medium">{extra.name}</span>
                    <span className="text-xs text-muted-foreground">Consultar</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Field label="Dirección" htmlFor="address">
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha" htmlFor="date">
                <input id="date" name="date" type="date" min={todayISO()} className={cn(fieldClass, "pr-2")} required />
              </Field>
              <Field label="Horario" htmlFor="time">
                <SelectWrap>
                  <select id="time" name="time" defaultValue="" className={cn(fieldClass, "appearance-none pr-10")} required>
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

            <p className="text-xs text-muted-foreground">
              {SERVICE_DAYS.full} de {SERVICE_HOURS.open} a {SERVICE_HOURS.close}.
            </p>

            {error && (
              <p role="alert" className="rounded-xl bg-sky px-4 py-3 text-sm text-white">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="group mt-1 inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground shadow-glow transition-transform active:scale-[0.98]"
            >
              <WhatsAppIcon className="size-5" />
              Reservar por WhatsApp
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          </form>
        </Reveal>
      </div>
    </section>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm text-muted-foreground">
        {label}
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
