"use client"

import { useId, useMemo, useState } from "react"
import { Check, MapPin, Search, X } from "lucide-react"
import { DEPARTMENTS, whatsappUrl } from "@/lib/site"
import { SectionHeading } from "./section-heading"
import { WhatsAppIcon } from "./whatsapp-icon"

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

type Match = { department: string; area?: string }

function findMatches(query: string): Match[] {
  const q = normalize(query)
  if (q.length < 2) return []
  const results: Match[] = []
  for (const dept of DEPARTMENTS) {
    if (normalize(dept.name).includes(q)) results.push({ department: dept.name })
    for (const area of dept.areas) {
      if (normalize(area).includes(q)) results.push({ department: dept.name, area })
    }
  }
  return results.slice(0, 5)
}

export function Coverage() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Match | null>(null)
  const inputId = useId()
  const matches = useMemo(() => findMatches(query), [query])

  const status: "idle" | "covered" | "unknown" = selected
    ? "covered"
    : query.trim().length >= 2 && matches.length === 0
      ? "unknown"
      : "idle"

  const label = selected ? (selected.area ? `${selected.area}, ${selected.department}` : selected.department) : ""

  return (
    <section aria-labelledby="cobertura-title" id="cobertura" className="bg-background py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          id="cobertura-title"
          eyebrow="03 — Cobertura"
          title="Llegamos a todo Gran Mendoza."
          description="Escribí tu barrio, distrito o departamento y verificá si llegamos."
        />

        <div className="mt-12 flex flex-col gap-6 md:flex-row md:gap-10">
          <div className="flex-1">
            <label htmlFor={inputId} className="sr-only">
              Tu barrio o departamento
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id={inputId}
                type="text"
                inputMode="search"
                autoComplete="address-level2"
                placeholder="Ej: Chacras de Coria"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelected(null)
                }}
                className="h-16 w-full rounded-full border border-border bg-white pl-14 pr-14 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
                aria-describedby={`${inputId}-status`}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("")
                    setSelected(null)
                  }}
                  className="absolute right-2.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  aria-label="Borrar búsqueda"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {!selected && matches.length > 0 ? (
              <ul className="mt-2 overflow-hidden rounded-3xl border border-border bg-white" aria-label="Sugerencias">
                {matches.map((m) => (
                  <li key={`${m.department}-${m.area ?? ""}`} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(m)
                        setQuery(m.area ?? m.department)
                      }}
                      className="flex min-h-14 w-full items-center gap-3 px-5 text-left transition-colors hover:bg-muted"
                    >
                      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="text-base">{m.area ?? m.department}</span>
                      {m.area ? <span className="ml-auto text-sm text-muted-foreground">{m.department}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div id={`${inputId}-status`} aria-live="polite" className="mt-4">
              {status === "covered" ? (
                <div className="flex flex-col gap-4 rounded-3xl bg-inverse p-6 text-inverse-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-inverse-foreground text-inverse">
                      <Check className="size-4" aria-hidden="true" />
                    </span>
                    <p className="text-lg font-semibold tracking-tight">Sí, llegamos a {label}.</p>
                  </div>
                  <a
                    href={whatsappUrl(`Hola MK Cars, quiero reservar un lavado a domicilio en ${label}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-inverse-foreground px-6 text-base font-medium text-inverse transition-opacity hover:opacity-90"
                  >
                    <WhatsAppIcon className="size-5" />
                    Reservar en mi zona
                  </a>
                </div>
              ) : null}
              {status === "unknown" ? (
                <div className="flex flex-col gap-4 rounded-3xl border border-border p-6">
                  <p className="text-pretty leading-relaxed">
                    <strong className="font-semibold">No encontramos esa zona.</strong>{" "}
                    <span className="text-muted-foreground">Escribinos y te confirmamos si podemos llegar.</span>
                  </p>
                  <a
                    href={whatsappUrl(`Hola MK Cars, ¿llegan a ${query.trim()}?`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-inverse px-6 text-base font-medium text-inverse-foreground transition-opacity hover:opacity-90"
                  >
                    <WhatsAppIcon className="size-5" />
                    Consultar por WhatsApp
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-2 md:w-5/12" aria-label="Departamentos con cobertura">
            {DEPARTMENTS.map((dept) => (
              <li key={dept.name}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected({ department: dept.name })
                    setQuery(dept.name)
                  }}
                  aria-pressed={selected?.department === dept.name && !selected.area}
                  className={`flex min-h-20 w-full flex-col justify-between gap-2 rounded-2xl border p-4 text-left transition-colors ${
                    selected?.department === dept.name
                      ? "border-inverse bg-inverse text-inverse-foreground"
                      : "border-border bg-white hover:border-foreground"
                  }`}
                >
                  <MapPin className="size-4" aria-hidden="true" />
                  <span className="text-base font-medium leading-tight">{dept.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
