"use client"

import { useState, type FormEvent } from "react"
import { Check, LoaderCircle, LocateFixed, Search, X } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"
import {
  COVERAGE_KEYWORDS,
  COVERAGE_ZONES,
  GRAN_MENDOZA_BOUNDS,
  normalize,
  whatsappUrl,
} from "@/lib/site"
import { cn } from "@/lib/utils"

type Status =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "covered"; label: string }
  | { kind: "unknown"; label: string }
  | { kind: "error"; message: string }

function isInGranMendoza(lat: number, lng: number) {
  const b = GRAN_MENDOZA_BOUNDS
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax
}

export function Coverage() {
  const [address, setAddress] = useState("")
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  function checkAddress(e: FormEvent) {
    e.preventDefault()
    const query = normalize(address)
    if (query.length < 3) {
      setStatus({ kind: "error", message: "Ingresá tu dirección, barrio o departamento." })
      return
    }
    const covered = COVERAGE_KEYWORDS.some((k) => query.includes(k))
    setStatus(covered ? { kind: "covered", label: address.trim() } : { kind: "unknown", label: address.trim() })
  }

  function useLocation() {
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "error", message: "Tu navegador no permite compartir la ubicación." })
      return
    }
    setStatus({ kind: "locating" })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const label = "tu ubicación actual"
        setStatus(
          isInGranMendoza(coords.latitude, coords.longitude) ? { kind: "covered", label } : { kind: "unknown", label },
        )
      },
      () => setStatus({ kind: "error", message: "No pudimos obtener tu ubicación. Probá escribiendo tu dirección." }),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  return (
    <section id="cobertura" className="relative overflow-hidden border-t border-border bg-surface/40 py-24 md:py-36">
      <div
        className="pointer-events-none absolute -right-40 top-10 size-[28rem] rounded-full bg-silver/5 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <SectionHeading
          index="04"
          eyebrow="Cobertura"
          title="Todo Gran Mendoza."
          description="Ingresá tu dirección y confirmá que llegamos hasta vos."
        />

        <Reveal className="mt-12 max-w-2xl">
          <form onSubmit={checkAddress} className="flex flex-col gap-3" noValidate>
            <label htmlFor="coverage-address" className="sr-only">
              Dirección o barrio
            </label>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1.5 pl-5 transition-colors focus-within:border-foreground/40">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                id="coverage-address"
                type="text"
                inputMode="search"
                autoComplete="street-address"
                placeholder="Ej: Chacras de Coria, Luján"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  if (status.kind !== "idle") setStatus({ kind: "idle" })
                }}
                className="min-h-12 w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              <button
                type="submit"
                className="min-h-12 shrink-0 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-transform active:scale-95"
              >
                Consultar
              </button>
            </div>
            <button
              type="button"
              onClick={useLocation}
              disabled={status.kind === "locating"}
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-full px-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              {status.kind === "locating" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed className="size-4" aria-hidden="true" />
              )}
              Usar mi ubicación
            </button>
          </form>

          <div aria-live="polite" className="mt-2 min-h-0">
            {status.kind === "covered" && (
              <ResultCard tone="ok" title={`Sí, llegamos a ${status.label}.`}>
                <a
                  href="#reservar"
                  className="mt-4 inline-flex min-h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
                >
                  Reservar turno
                </a>
              </ResultCard>
            )}
            {status.kind === "unknown" && (
              <ResultCard tone="warn" title="No pudimos confirmar esa zona.">
                <p className="mt-1 text-sm text-muted-foreground">Escribinos y lo consultamos al instante.</p>
                <a
                  href={whatsappUrl(`Hola MK Cars, ¿llegan a ${status.label}?`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-11 items-center rounded-full border border-foreground/25 px-5 text-sm font-medium"
                >
                  Consultar por WhatsApp
                </a>
              </ResultCard>
            )}
            {status.kind === "error" && <p className="mt-2 text-sm text-muted-foreground">{status.message}</p>}
          </div>
        </Reveal>

        <Reveal className="mt-14">
          <ul className="flex flex-wrap gap-2" aria-label="Departamentos con cobertura">
            {COVERAGE_ZONES.map((zone) => (
              <li
                key={zone}
                className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm text-foreground/80"
              >
                {zone}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

function ResultCard({
  tone,
  title,
  children,
}: {
  tone: "ok" | "warn"
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="animate-fade-up mt-4 flex gap-4 rounded-2xl border border-border bg-background p-5">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          tone === "ok" ? "bg-foreground text-background" : "border border-border text-muted-foreground",
        )}
      >
        {tone === "ok" ? <Check className="size-5" aria-hidden="true" /> : <X className="size-5" aria-hidden="true" />}
      </span>
      <div className="flex flex-col items-start">
        <p className="pt-2 font-medium leading-snug">{title}</p>
        {children}
      </div>
    </div>
  )
}
