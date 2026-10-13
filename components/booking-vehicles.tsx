"use client"

import { useState } from "react"
import useSWR from "swr"
import { Info, Plus, Trash2, X } from "lucide-react"
import { VehicleLineIcon } from "@/components/vehicle-line-icon"
import { VehicleSearch } from "@/components/vehicle-search"
import { VEHICLES, formatARS } from "@/lib/site"
import type { CatalogEntry } from "@/lib/vehicle-catalog"
import type { VehiclePrices } from "@/lib/prices"
import { cn } from "@/lib/utils"

export const MAX_VEHICLES = 10

export type BookingVehicle = {
  key: number
  mode: "search" | "manual"
  query: string
  catalogId: string | null
  lockedCategory: string | null
  category: string
  brand: string
  model: string
}

export const emptyVehicle = (key: number): BookingVehicle => ({
  key,
  mode: "search",
  query: "",
  catalogId: null,
  lockedCategory: null,
  category: "",
  brand: "",
  model: "",
})

const CATEGORY_LABEL: Record<string, string> = { auto: "Auto", suv: "SUV", pickup: "Pick-up" }

const inputClass =
  "min-h-12 w-full rounded-xl border border-border bg-card px-3.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm"

const fetchCatalog = async (url: string): Promise<CatalogEntry[]> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("catalog")
  return res.json()
}

const lockNotice = (category: string) =>
  `El modelo seleccionado corresponde a la categoría ${CATEGORY_LABEL[category]}. Actualizamos el precio para que tu reserva sea correcta.`

function VehicleCard({
  item,
  index,
  removable,
  prices,
  catalog,
  loading,
  onActivate,
  onUpdate,
  onRemove,
}: {
  item: BookingVehicle
  index: number
  removable: boolean
  prices: VehiclePrices | null
  catalog: CatalogEntry[] | undefined
  loading: boolean
  onActivate: () => void
  onUpdate: (patch: Partial<BookingVehicle>) => void
  onRemove: () => void
}) {
  const [notice, setNotice] = useState<string | null>(null)
  const selected = item.catalogId !== null
  const ambiguous = selected && !item.lockedCategory

  function selectEntry(entry: CatalogEntry) {
    const changed = entry.category && item.category && item.category !== entry.category
    setNotice(changed ? lockNotice(entry.category!) : null)
    onUpdate({
      catalogId: entry.id,
      lockedCategory: entry.category,
      category: entry.category ?? "",
      brand: entry.brand,
      model: entry.model,
      query: `${entry.brand} ${entry.model}`,
    })
  }

  function clearSelection(mode: BookingVehicle["mode"]) {
    setNotice(null)
    onUpdate({
      mode,
      catalogId: null,
      lockedCategory: null,
      brand: mode === "manual" && !selected ? "" : item.brand,
      model: mode === "manual" && !selected ? item.query.trim() : item.model,
      query: "",
    })
  }

  function pickCategory(category: string) {
    if (item.lockedCategory) {
      setNotice(category === item.lockedCategory ? null : lockNotice(item.lockedCategory))
      return
    }
    setNotice(null)
    onUpdate({ category })
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">
          Vehículo {index + 1}
          <span className="text-primary" aria-hidden="true">
            {" *"}
          </span>
        </p>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-white"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Quitar
            <span className="sr-only">{`vehículo ${index + 1}`}</span>
          </button>
        )}
      </div>

      {item.mode === "manual" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Marca (opcional)</span>
              <input
                type="text"
                value={item.brand}
                maxLength={60}
                onChange={(e) => onUpdate({ brand: e.target.value })}
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
                onChange={(e) => onUpdate({ model: e.target.value })}
                placeholder="Ej: Hilux"
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ mode: "search", brand: "", model: "", query: "" })}
            className="w-fit text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Volver al buscador
          </button>
        </div>
      ) : selected ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Tu vehículo</span>
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-primary/40 bg-card pl-3.5 pr-1.5">
            <span className="truncate text-sm text-white">
              <span className="text-muted-foreground">{item.brand}</span> {item.model}
            </span>
            <button
              type="button"
              onClick={() => {
                setNotice(null)
                onUpdate({ catalogId: null, lockedCategory: null, brand: "", model: "", query: "" })
              }}
              className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-white"
            >
              <X className="size-3.5" aria-hidden="true" />
              Cambiar
              <span className="sr-only">{`modelo del vehículo ${index + 1}`}</span>
            </button>
          </div>
        </div>
      ) : (
        <VehicleSearch
          query={item.query}
          catalog={catalog}
          loading={loading}
          onActivate={onActivate}
          onQueryChange={(query) => onUpdate({ query })}
          onSelect={selectEntry}
          onNotListed={() => clearSelection("manual")}
        />
      )}

      <fieldset className="min-w-0">
        <legend className="sr-only">{`Tipo de vehículo ${index + 1}`}</legend>
        <div className="grid grid-cols-3 gap-2">
          {VEHICLES.map((v) => {
            const checked = item.category === v.id
            const disabled = Boolean(item.lockedCategory) && !checked
            return (
              <label
                key={v.id}
                className={cn(
                  "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20",
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-white/80 hover:border-white/30",
                  disabled && "opacity-50",
                )}
              >
                <input
                  type="radio"
                  name={`vehicle-${item.key}`}
                  value={v.id}
                  checked={checked}
                  onChange={() => pickCategory(v.id)}
                  onClick={() => pickCategory(v.id)}
                  className="sr-only"
                />
                <span className="flex h-6 items-center">
                  <VehicleLineIcon id={v.id} width={v.id === "pickup" ? 64 : 52} />
                </span>
                {prices && (
                  <>
                    <span className="sr-only">desde</span>
                    <span className={cn("text-sm font-semibold tabular-nums", checked ? "text-primary" : "text-white")}>
                      {formatARS(prices[v.id])}
                    </span>
                  </>
                )}
                <span className={cn("-mt-1 text-xs font-medium", checked ? "text-primary" : "text-white/70")}>
                  {v.id === "pickup" ? "Pick Up" : v.name}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div aria-live="polite" className="empty:hidden">
        {notice ? (
          <p className="flex gap-2 text-xs leading-relaxed text-primary">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        ) : item.mode === "manual" || ambiguous ? (
          <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {ambiguous
              ? "Este modelo tiene distintas carrocerías. Elegí el tipo de vehículo. Confirmaremos los datos antes del lavado."
              : "Si no encontrás tu modelo, elegí el tipo de vehículo. Confirmaremos los datos antes del lavado."}
          </p>
        ) : null}
      </div>
    </li>
  )
}

export function BookingVehicles({
  vehicles,
  prices,
  onChange,
  onAdd,
}: {
  vehicles: BookingVehicle[]
  prices: VehiclePrices | null
  onChange: (vehicles: BookingVehicle[]) => void
  onAdd: () => void
}) {
  const [loadCatalog, setLoadCatalog] = useState(false)
  const { data: catalog, isLoading } = useSWR(loadCatalog ? "/api/vehicle-catalog" : null, fetchCatalog, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  })

  const total = prices
    ? vehicles.reduce((sum, v) => sum + (prices[v.category as keyof VehiclePrices] ?? 0), 0)
    : 0
  const complete = vehicles.every((v) => v.category)

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {vehicles.map((item, index) => (
          <VehicleCard
            key={item.key}
            item={item}
            index={index}
            removable={vehicles.length > 1}
            prices={prices}
            catalog={catalog}
            loading={loadCatalog && isLoading}
            onActivate={() => setLoadCatalog(true)}
            onUpdate={(patch) => onChange(vehicles.map((v) => (v.key === item.key ? { ...v, ...patch } : v)))}
            onRemove={() => onChange(vehicles.filter((v) => v.key !== item.key))}
          />
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
        {!prices && (
          <p className="text-sm text-muted-foreground">
            Precios no disponibles en este momento. Te confirmamos el importe por WhatsApp.
          </p>
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
