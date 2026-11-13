"use client"

import { ChevronDown, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

export const LAST_WASH_OPTIONS = [
  { id: "30", label: "Dentro de los últimos 30 días", increment: 0 },
  { id: "60", label: "Dentro de los últimos 60 días", increment: 10 },
  { id: "90", label: "Hace más de 60 días", increment: 15 },
  { id: "more", label: "Hace más de 90 días", increment: 20 },
] as const

export const CONDITION_OPTIONS = [
  { id: "pets", label: "Pelos de mascota" },
  { id: "mud", label: "Barro o tierra en exceso" },
  { id: "sand", label: "Arena" },
  { id: "stains", label: "Manchas en tapizados" },
  { id: "trash", label: "Restos de comida o basura" },
  { id: "odor", label: "Olores fuertes" },
] as const

export type VehicleConditionValue = {
  lastWash: string
  conditions: string[]
}

export const defaultVehicleCondition = (): VehicleConditionValue => ({ lastWash: "30", conditions: [] })

const CONDITION_STEP = 5

const STAINS_INCREMENT = 20

export function estimatedIncrement({ lastWash, conditions }: VehicleConditionValue) {
  if (conditions.includes("stains")) return STAINS_INCREMENT
  const base = LAST_WASH_OPTIONS.find((o) => o.id === lastWash)?.increment ?? 0
  const raw = base + conditions.length * CONDITION_STEP
  if (raw <= 0) return 0
  if (raw <= 10) return 10
  if (raw <= 15) return 15
  return 20
}

export function incrementNotice(increment: number, value?: VehicleConditionValue) {
  if (value?.conditions.includes("stains")) {
    return `Las manchas en tapizados pueden generar un incremento del ${STAINS_INCREMENT}%.`
  }
  if (increment === 0) return "Sin incremento estimado por el estado del vehículo."
  const range = increment === 10 ? "de hasta el 10%" : increment === 15 ? "del 10% al 15%" : "del 15% al 20%"
  return `Puede existir un incremento estimado ${range} según el estado del vehículo.`
}

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })

export function estimateRange(basePrice: number, increment: number) {
  const max = Math.round((basePrice * (1 + increment / 100)) / 100) * 100
  return increment === 0 || max === basePrice
    ? money.format(basePrice)
    : `${money.format(basePrice)} a ${money.format(max)}`
}

export function conditionSummary(value: VehicleConditionValue, basePrice = 0) {
  const lastWash = LAST_WASH_OPTIONS.find((o) => o.id === value.lastWash)?.label ?? "Sin indicar"
  const conditions = CONDITION_OPTIONS.filter((o) => value.conditions.includes(o.id)).map((o) => o.label)
  const increment = estimatedIncrement(value)
  return [
    "Estado del vehículo:",
    `Último lavado: ${lastWash}`,
    `Condiciones: ${conditions.length ? conditions.join(", ") : "Ninguna seleccionada"}`,
    `Aviso: ${incrementNotice(increment, value)}`,
    ...(basePrice > 0 ? [`Presupuesto estimado: ${estimateRange(basePrice, increment)}`] : []),
  ]
}

export function VehicleCondition({
  value,
  onChange,
  basePrice = 0,
}: {
  value: VehicleConditionValue
  onChange: (value: VehicleConditionValue) => void
  basePrice?: number
}) {
  const increment = estimatedIncrement(value)

  function toggle(id: string) {
    onChange({
      ...value,
      conditions: value.conditions.includes(id)
        ? value.conditions.filter((c) => c !== id)
        : [...value.conditions, id],
    })
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <legend className="sr-only">Estado del vehículo</legend>
      <p aria-hidden="true" className="text-xs font-medium uppercase tracking-wider text-primary">
        Estado del vehículo
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="last-wash" className="text-xs text-muted-foreground">
          Último lavado
        </label>
        <div className="relative">
          <select
            id="last-wash"
            value={value.lastWash}
            onChange={(e) => onChange({ ...value, lastWash: e.target.value })}
            className="min-h-12 w-full appearance-none rounded-xl border border-border bg-card pl-3.5 pr-10 text-base text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm"
          >
            {LAST_WASH_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p id="conditions-label" className="text-xs text-muted-foreground">
          Condiciones <span className="text-muted-foreground/70">(opcional)</span>
        </p>
        <div role="group" aria-labelledby="conditions-label" className="flex flex-wrap gap-2">
          {CONDITION_OPTIONS.map((o) => {
            const checked = value.conditions.includes(o.id)
            return (
              <label
                key={o.id}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 text-sm transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20",
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-white/80 hover:border-white/30",
                )}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(o.id)} className="sr-only" />
                {o.label}
              </label>
            )
          })}
        </div>
      </div>

      <p
        aria-live="polite"
        className={cn(
          "flex gap-2 rounded-xl border px-3.5 py-3 text-sm leading-relaxed",
          increment ? "border-primary/40 bg-primary/10 text-white" : "border-border bg-card text-muted-foreground",
        )}
      >
        <TriangleAlert className="size-5 shrink-0 fill-yellow-400 text-black" strokeWidth={2.25} aria-hidden="true" />
        <span>
          <span className="font-medium">Aviso: </span>
          {incrementNotice(increment, value)}
        </span>
      </p>

      <div
        aria-live="polite"
        className="flex flex-col gap-0.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-3"
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Presupuesto estimado</span>
        {basePrice > 0 ? (
          <>
            <span className="text-lg font-semibold text-white tabular-nums">{estimateRange(basePrice, increment)}</span>
            <span className="text-xs text-muted-foreground">
              {increment
                ? `Precio base + hasta ${increment}% según el estado del vehículo. Se confirma al ver el vehículo.`
                : "Precio base del lavado. Se confirma al ver el vehículo."}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Elegí el tipo de vehículo para ver el presupuesto.</span>
        )}
      </div>
    </fieldset>
  )
}
