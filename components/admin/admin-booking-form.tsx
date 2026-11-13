"use client"

import { useActionState, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { createManualAppointment } from "@/app/admin/(panel)/offer-actions"
import { AddressInput } from "@/components/address-input"
import { BookingVehicles, emptyVehicle, type BookingVehicle } from "@/components/booking-vehicles"
import {
  VehicleCondition,
  conditionSummary,
  defaultVehicleCondition,
  type VehicleConditionValue,
} from "@/components/vehicle-condition"
import { WHATSAPP_DEFAULT_PREFIX } from "@/lib/booking"
import type { VehiclePrices } from "@/lib/prices"
import { EXTRAS } from "@/lib/site"

const fieldClass =
  "min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 sm:text-sm"

const SOURCES: [string, string][] = [
  ["whatsapp", "WhatsApp"],
  ["telefono", "Teléfono"],
  ["instagram", "Instagram"],
  ["presencial", "Presencial"],
  ["otro", "Otro"],
]

function vehicleDetail(v: BookingVehicle) {
  if (v.catalogId || v.mode === "manual") return { brand: v.brand.trim(), model: v.model.trim() }
  return { brand: "", model: v.query.trim() }
}

export function AdminBookingForm({
  prices,
  client,
  defaultAddress = "",
  defaultNoWater = false,
}: {
  prices: VehiclePrices | null
  client: { full_name: string; whatsapp: string | null } | null
  defaultAddress?: string
  defaultNoWater?: boolean
}) {
  const [state, formAction, pending] = useActionState(createManualAppointment, { ok: false, message: null })
  const [, startTransition] = useTransition()
  const [vehicles, setVehicles] = useState<BookingVehicle[]>([emptyVehicle(0)])
  const [condition, setCondition] = useState<VehicleConditionValue>(defaultVehicleCondition)
  const nextKey = useRef(1)
  const filled = vehicles.filter((v) => v.category)
  const basePrice = prices ? filled.reduce((sum, v) => sum + (prices[v.category as keyof VehiclePrices] ?? 0), 0) : 0

  function addVehicle() {
    const last = vehicles[vehicles.length - 1]
    setVehicles([
      ...vehicles,
      { ...emptyVehicle(nextKey.current++), category: last && !last.lockedCategory ? last.category : "" },
    ])
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const notes = String(data.get("client_notes") ?? "").trim()
    const touchedCondition = condition.conditions.length > 0 || condition.lastWash !== defaultVehicleCondition().lastWash
    const conditionLines = filled.length || touchedCondition ? conditionSummary(condition, basePrice).join("\n") : ""
    data.set("client_notes", [notes, conditionLines].filter(Boolean).join("\n\n"))
    data.set(
      "vehicles",
      JSON.stringify(filled.map((v) => ({ category: v.category, catalog_id: v.catalogId, ...vehicleDetail(v) }))),
    )
    startTransition(() => formAction(data))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted-foreground text-pretty">
        Todos los campos son opcionales. Completá lo que sepas y el resto lo editás después desde el turno.
      </p>

      <div className="flex flex-col gap-4">
        <SectionLabel>Vehículos</SectionLabel>
        <BookingVehicles vehicles={vehicles} prices={prices} onChange={setVehicles} onAdd={addVehicle} />
        <VehicleCondition value={condition} onChange={setCondition} basePrice={basePrice} />
      </div>

      <div className="flex flex-col gap-5">
        <SectionLabel>Datos del turno</SectionLabel>
        <div className="grid gap-5 md:grid-cols-2 md:gap-x-6">
          <Field label="Nombre y apellido" htmlFor="full_name">
            <input
              id="full_name"
              name="full_name"
              maxLength={120}
              autoComplete="off"
              defaultValue={client?.full_name ?? ""}
              placeholder="Nombre del cliente"
              className={fieldClass}
            />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp">
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              defaultValue={client?.whatsapp ? `+${client.whatsapp}` : WHATSAPP_DEFAULT_PREFIX}
              readOnly={Boolean(client?.whatsapp)}
              aria-describedby="whatsapp-hint"
              className={fieldClass}
            />
            <p id="whatsapp-hint" className="text-xs text-muted-foreground">
              Para otro país o provincia, editá el código del principio.
            </p>
          </Field>
          <Field label="Dirección" htmlFor="address">
            <AddressInput className={fieldClass} defaultValue={defaultAddress} />
          </Field>
          <Field label="Origen del pedido" htmlFor="source">
            <div className="relative">
              <select id="source" name="source" defaultValue="whatsapp" className={`${fieldClass} appearance-none pr-10`}>
                {SOURCES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </Field>
          <Field label="Precio acordado" htmlFor="price">
            <input
              id="price"
              name="price"
              type="number"
              min={0}
              max={10_000_000}
              step={100}
              placeholder={basePrice ? String(basePrice) : ""}
              className={`${fieldClass} tabular-nums`}
            />
          </Field>
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Lavado en detalle</legend>
        <details className="group rounded-2xl border border-border bg-surface/60 open:bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-sm font-medium text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col py-2">
              Sumar lavado en detalle
              <span className="text-xs font-normal text-muted-foreground">Tapizados y motor</span>
            </span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
            {EXTRAS.map((extra) => (
              <label
                key={extra.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/40 px-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-sky has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40"
              >
                <input type="checkbox" name="extras" value={extra.id} className="size-5 accent-primary" />
                <span className="flex-1 text-sm font-medium text-white">{extra.name}</span>
              </label>
            ))}
          </div>
        </details>
        <label className="mt-1 flex cursor-pointer items-center gap-3 px-1">
          <input type="checkbox" name="no_water" defaultChecked={defaultNoWater} className="size-4 accent-primary" />
          <span className="text-sm text-white">No hay agua en el domicilio: llevamos agua propia</span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-4">
        <Field label="Comentarios del cliente" htmlFor="client_notes">
          <textarea id="client_notes" name="client_notes" rows={3} maxLength={1000} className={`${fieldClass} py-3`} />
        </Field>
        <Field label="Nota interna (no la ve el cliente)" htmlFor="internal_note">
          <textarea id="internal_note" name="internal_note" rows={3} maxLength={4000} className={`${fieldClass} py-3`} />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="ignore_duplicate" defaultChecked={Boolean(client)} className="size-4 accent-primary" />
          Crear igual aunque el cliente ya tenga un turno activo
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-70"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Crear turno
        </button>
        <p aria-live="polite" className={state.message ? "text-sm text-red-200" : "sr-only"}>
          {state.message}
        </p>
      </div>
    </form>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wider text-primary">{children}</p>
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
