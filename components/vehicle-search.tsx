"use client"

import { useId, useMemo, useState, type KeyboardEvent } from "react"
import { Loader2, Search } from "lucide-react"
import { type CatalogEntry, indexCatalog, searchCatalog } from "@/lib/vehicle-catalog"
import { cn } from "@/lib/utils"

const CATEGORY_LABEL: Record<string, string> = { auto: "Auto", suv: "SUV", pickup: "Pick-up" }

export function VehicleSearch({
  query,
  catalog,
  loading,
  onActivate,
  onQueryChange,
  onSelect,
  onNotListed,
}: {
  query: string
  catalog: CatalogEntry[] | undefined
  loading: boolean
  onActivate: () => void
  onQueryChange: (query: string) => void
  onSelect: (entry: CatalogEntry) => void
  onNotListed: () => void
}) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const index = useMemo(() => (catalog ? indexCatalog(catalog) : []), [catalog])
  const results = useMemo(() => searchCatalog(index, query), [index, query])
  const showList = open && query.trim().length > 0 && !loading
  const optionCount = results.length + 1

  function choose(position: number) {
    setOpen(false)
    if (position < results.length) onSelect(results[position])
    else onNotListed()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a + 1) % optionCount)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => (a - 1 + optionCount) % optionCount)
    } else if (e.key === "Enter" && showList) {
      e.preventDefault()
      choose(active)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        Buscá tu vehículo
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          maxLength={60}
          onFocus={() => {
            onActivate()
            setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            onQueryChange(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ej.: Toyota Hilux, Peugeot 208, VW Amarok"
          className="min-h-12 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-base text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm"
        />
        {loading && query.trim() && (
          <Loader2
            className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Cargando modelos"
          />
        )}
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label="Vehículos encontrados"
        hidden={!showList}
        className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl shadow-black/40"
      >
        {results.map((entry, i) => (
          <li
            key={entry.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={active === i}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(i)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-sm",
              active === i ? "bg-primary/10 text-white" : "text-white/85",
            )}
          >
            <span className="truncate">
              <span className="text-muted-foreground">{entry.brand}</span> {entry.model}
            </span>
            {entry.category && (
              <span className="shrink-0 text-xs text-muted-foreground">{CATEGORY_LABEL[entry.category]}</span>
            )}
          </li>
        ))}
        {results.length === 0 && (
          <li role="presentation" className="px-3 py-2 text-xs text-muted-foreground">
            No encontramos coincidencias.
          </li>
        )}
        <li
          id={`${listId}-${results.length}`}
          role="option"
          aria-selected={active === results.length}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(results.length)}
          onClick={() => choose(results.length)}
          className={cn(
            "flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-medium text-primary",
            active === results.length && "bg-primary/10",
          )}
        >
          Mi vehículo no aparece
        </li>
      </ul>
    </div>
  )
}
