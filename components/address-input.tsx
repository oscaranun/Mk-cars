"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"
import { CheckCircle2, Loader2, MapPin, MessageCircle, Smile, XCircle } from "lucide-react"
import { COVERAGE_BOUNDS, isInCoverage } from "@/lib/coverage"
import { whatsappUrl } from "@/lib/site"
import { cn } from "@/lib/utils"

/* eslint-disable @typescript-eslint/no-explicit-any */
type PlacesLib = any
type Suggestion = { id: string; main: string; secondary: string; prediction: any }
export type CoverageStatus = "unknown" | "inside" | "outside"

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
let placesLoader: Promise<PlacesLib> | null = null

function loadPlaces(): Promise<PlacesLib> {
  if (placesLoader) return placesLoader
  placesLoader = new Promise((resolve, reject) => {
    const w = window as any
    if (w.google?.maps?.importLibrary) return resolve(w.google.maps.importLibrary("places"))
    w.__mkMapsReady = () => resolve(w.google.maps.importLibrary("places"))
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async&language=es&region=AR&callback=__mkMapsReady`
    script.async = true
    script.onerror = () => {
      placesLoader = null
      reject(new Error("Google Maps failed to load"))
    }
    document.head.appendChild(script)
  })
  return placesLoader
}

export function AddressInput({
  className,
  onStatusChange,
}: {
  className: string
  onStatusChange?: (status: CoverageStatus) => void
}) {
  const listId = useId()
  const [value, setValue] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<CoverageStatus>("unknown")
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionToken = useRef<any>(null)
  const requestId = useRef(0)

  function updateStatus(next: CoverageStatus) {
    setStatus(next)
    onStatusChange?.(next)
  }

  function handleChange(next: string) {
    setValue(next)
    setCoords(null)
    if (status !== "unknown") updateStatus("unknown")
    if (debounce.current) clearTimeout(debounce.current)
    if (!API_KEY || next.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounce.current = setTimeout(() => fetchSuggestions(next), 250)
  }

  async function fetchSuggestions(input: string) {
    const id = ++requestId.current
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await loadPlaces()
      sessionToken.current ??= new AutocompleteSessionToken()
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionToken.current,
        includedRegionCodes: ["ar"],
        locationRestriction: COVERAGE_BOUNDS,
        language: "es",
      })
      if (id !== requestId.current) return
      const mapped: Suggestion[] = results
        .filter((s: any) => s.placePrediction)
        .slice(0, 5)
        .map((s: any) => ({
          id: s.placePrediction.placeId,
          main: s.placePrediction.mainText?.toString() ?? s.placePrediction.text.toString(),
          secondary: s.placePrediction.secondaryText?.toString() ?? "",
          prediction: s.placePrediction,
        }))
      setSuggestions(mapped)
      setActive(-1)
      setOpen(mapped.length > 0)
    } catch {
      setSuggestions([])
      setOpen(false)
    }
  }

  async function select(s: Suggestion) {
    setOpen(false)
    setValue([s.main, s.secondary].filter(Boolean).join(", "))
    setLoading(true)
    try {
      const place = s.prediction.toPlace()
      await place.fetchFields({ fields: ["location", "formattedAddress"] })
      sessionToken.current = null
      const lat = place.location.lat()
      const lng = place.location.lng()
      setCoords({ lat, lng })
      if (place.formattedAddress) setValue(place.formattedAddress)
      updateStatus(isInCoverage(lat, lng) ? "inside" : "outside")
    } catch {
      updateStatus("unknown")
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      if (active >= 0) {
        e.preventDefault()
        select(suggestions[active])
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          id="address"
          name="address"
          type="text"
          autoComplete="off"
          placeholder="Calle, número y departamento"
          className={cn(className, "pr-12")}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && !coords && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={`${listId}-status`}
          required
        />
        <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : status === "inside" ? (
            <CheckCircle2 className="size-7 fill-green-600 text-white" strokeWidth={2.5} aria-hidden="true" />
          ) : status === "outside" ? (
            <XCircle className="size-5 text-red-400" aria-hidden="true" />
          ) : (
            <img src="/images/google-maps.png" alt="" aria-hidden="true" className="size-6 rounded-md object-contain" />
          )}
        </span>
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-soft"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  select(s)
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-4 py-3 text-sm",
                  i === active && "bg-surface",
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground">{s.main}</span>
                  {s.secondary && <span className="truncate text-xs text-muted-foreground">{s.secondary}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />

      <div id={`${listId}-status`} aria-live="polite" className="min-h-0 text-xs">
        {status === "inside" && (
          <p className="flex items-center gap-2 rounded-xl border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm font-semibold text-green-700">
            <Smile className="size-5 shrink-0 text-green-600" aria-hidden="true" />
            ¡Genial! Llegamos a tu domicilio.
          </p>
        )}
        {status === "outside" && (
          <p className="text-red-400">
            Esta dirección está fuera de nuestra zona de cobertura.{" "}
            <a
              href={whatsappUrl(`Hola MK Cars, ¿llegan a ${value}?`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-electric underline-offset-2 hover:underline"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Consultanos
            </a>
          </p>
        )}
        {status === "unknown" && API_KEY && value.trim().length >= 3 && !open && !loading && (
          <p className="text-muted-foreground">Elegí tu dirección de la lista para confirmar la cobertura.</p>
        )}
      </div>
    </div>
  )
}
