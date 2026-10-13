"use client"

import { Plus, Trash2 } from "lucide-react"
import { VehicleLineIcon } from "@/components/vehicle-line-icon"
import { VEHICLES, formatARS } from "@/lib/site"
import { cn } from "@/lib/utils"

export const MAX_VEHICLES = 10

export type BookingVehicle = { key: number; category: string; brand: string; model: string }

const inputClass =
  "min-h-12 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10"

export function BookingVehicles({
  vehicles,
  onChange,
  onAdd,
}: {
  vehicles: BookingVehicle[]
  onChange: (vehicles: BookingVehicle[]) => void
  onAdd: () => void
}) {
  const total = vehicles.reduce((sum, v) => sum + (VEHICLES.find((x) => x.id === v.category)?.price ?? 0), 0)
  const complete = vehicles.every((v) => v.category)

  function update(key: number, patch: Partial<BookingVehicle>) {
    onChange(vehicles.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {vehicles.map((item, index) => (
          <li key={item.key} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">
                Vehículo {index + 1}
                <span className="text-primary" aria-hidden="true">
                  {" *"}
                </span>
              </p>
              {vehicles.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(vehicles.filter((v) => v.key !== item.key))}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-white"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Quitar
                  <span className="sr-only">{`vehículo ${index + 1}`}</span>
                </button>
              )}
            </div>

            <fieldset className="min-w-0">
              <legend className="sr-only">{`Tipo de vehículo ${index + 1}`}</legend>
              <div className="grid grid-cols-3 gap-2">
                {VEHICLES.map((v) => {
                  const checked = item.category === v.id
                  return (
                    <label
                      key={v.id}
                      className={cn(
                        "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20",
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-white/80 hover:border-white/30",
                      )}
                    >
                      <input
                        type="radio"
                        name={`vehicle-${item.key}`}
                        value={v.id}
                        checked={checked}
                        onChange={() => update(item.key, { category: v.id })}
                        className="sr-only"
                      />
                      <span className="flex h-6 items-center">
                        <VehicleLineIcon id={v.id} width={v.id === "pickup" ? 64 : 52} />
                      </span>
                      <span className="sr-only">desde</span>
                      <span
                        className={cn("text-sm font-semibold tabular-nums", checked ? "text-primary" : "text-white")}
                      >
                        {formatARS(v.price)}
                      </span>
                      <span className={cn("-mt-1 text-xs font-medium", checked ? "text-primary" : "text-white/70")}>
                        {v.id === "pickup" ? "Pick Up" : v.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Marca (opcional)</span>
                <input
                  type="text"
                  value={item.brand}
                  maxLength={60}
                  onChange={(e) => update(item.key, { brand: e.target.value })}
                  placeholder="Ej: Toyota"
                  className={inputClass}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Modelo (opcional)</span>
                <input
                  type="text"
                  value={item.model}
                  maxLength={60}
                  onChange={(e) => update(item.key, { model: e.target.value })}
                  placeholder="Ej: Hilux"
                  className={inputClass}
                />
              </label>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {vehicles.length < MAX_VEHICLES ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-dashed border-primary/50 px-5 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/10"
          >
            <Plus className="size-4" aria-hidden="true" />
            Agregar otro vehículo
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">{`Máximo ${MAX_VEHICLES} vehículos por reserva.`}</p>
        )}
        {total > 0 && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {vehicles.length === 1 ? "Precio" : `${vehicles.length} vehículos · total`}
            {complete ? " desde " : " parcial desde "}
            <span className="font-semibold tabular-nums text-white">{formatARS(total)}</span>
          </p>
        )}
      </div>
    </div>
  )
}
