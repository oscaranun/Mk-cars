"use client"

import { useState } from "react"
import { DEPARTMENTS, SERVICE_DAYS, SERVICE_HOURS, VEHICLES, type VehicleId, formatARS, whatsappUrl } from "@/lib/site"
import { SectionHeading } from "./section-heading"
import { WhatsAppIcon } from "./whatsapp-icon"

const WATER_OPTIONS = [
  { id: "propia", label: "Agua de MK Cars" },
  { id: "cliente", label: "Uso mi agua" },
] as const

const TIME_SLOTS = ["9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

function OptionGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  columns = 2,
}: {
  legend: string
  name: string
  options: readonly { id: T; label: string; hint?: string }[]
  value: T
  onChange: (value: T) => void
  columns?: 2 | 3
}) {
  return (
    <fieldset>
      <legend className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-inverse-muted">{legend}</legend>
      <div className={`grid gap-2 ${columns === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex min-h-14 cursor-pointer items-center justify-between gap-2 rounded-2xl border border-inverse-border px-4 py-3 transition-colors has-[:checked]:border-inverse-foreground has-[:checked]:bg-inverse-foreground has-[:checked]:text-inverse has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inverse-foreground"
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="sr-only"
            />
            <span className="text-base font-medium leading-tight">{option.label}</span>
            {option.hint ? <span className="text-sm opacity-70">{option.hint}</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const selectClass =
  "h-14 w-full appearance-none rounded-2xl border border-inverse-border bg-inverse px-4 text-base text-inverse-foreground outline-none transition-colors focus:border-inverse-foreground"

export function Booking() {
  const [vehicle, setVehicle] = useState<VehicleId>("auto")
  const [water, setWater] = useState<(typeof WATER_OPTIONS)[number]["id"]>("propia")
  const [zone, setZone] = useState<string>(DEPARTMENTS[0].name)
  const [time, setTime] = useState(TIME_SLOTS[0])

  const selectedVehicle = VEHICLES.find((v) => v.id === vehicle) ?? VEHICLES[0]
  const waterLabel = WATER_OPTIONS.find((w) => w.id === water)?.label ?? ""

  const message = [
    "Hola MK Cars, quiero reservar un lavado a domicilio.",
    `Vehículo: ${selectedVehicle.name} (${formatARS(selectedVehicle.price)})`,
    `Zona: ${zone}`,
    `Horario preferido: ${time} hs`,
    `Agua: ${waterLabel}`,
  ].join("\n")

  return (
    <section aria-labelledby="reservar-title" id="reservar" className="bg-inverse py-20 text-inverse-foreground md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col gap-12 md:flex-row md:gap-16">
          <div className="md:w-5/12">
            <SectionHeading
              id="reservar-title"
              eyebrow="05 — Reservar"
              title="Reservá en un minuto."
              description={`Elegí las opciones y te abrimos WhatsApp con el mensaje listo. Atendemos de ${SERVICE_DAYS.full.toLowerCase()}, de ${SERVICE_HOURS.open} a ${SERVICE_HOURS.close}.`}
              inverse
            />
          </div>

          <form
            className="flex flex-1 flex-col gap-8"
            onSubmit={(e) => {
              e.preventDefault()
              window.open(whatsappUrl(message), "_blank", "noopener,noreferrer")
            }}
          >
            <OptionGroup
              legend="Vehículo"
              name="vehicle"
              columns={3}
              options={VEHICLES.map((v) => ({ id: v.id, label: v.name, hint: formatARS(v.price) }))}
              value={vehicle}
              onChange={setVehicle}
            />

            <OptionGroup legend="Agua" name="water" options={WATER_OPTIONS} value={water} onChange={setWater} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="zone" className="mb-3 block font-mono text-xs uppercase tracking-[0.2em] text-inverse-muted">
                  Zona
                </label>
                <select id="zone" value={zone} onChange={(e) => setZone(e.target.value)} className={selectClass}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="time" className="mb-3 block font-mono text-xs uppercase tracking-[0.2em] text-inverse-muted">
                  Horario
                </label>
                <select id="time" value={time} onChange={(e) => setTime(e.target.value)} className={selectClass}>
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot} hs
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-inverse-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-inverse-muted">Total</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight">{formatARS(selectedVehicle.price)}</p>
              </div>
              <button
                type="submit"
                className="flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-accent px-7 text-base font-semibold text-inverse transition-opacity hover:opacity-90"
              >
                <WhatsAppIcon className="size-5" />
                Enviar por WhatsApp
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
