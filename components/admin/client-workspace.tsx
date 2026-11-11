"use client"

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

const TABS = [
  ["turnos", "Turnos y cobros"],
  ["datos", "Datos"],
  ["vehiculos", "Vehículos"],
  ["seguimiento", "Seguimiento"],
  ["historial", "Historial"],
] as const
type Tab = (typeof TABS)[number][0]
const Context = createContext<{ active: Tab; id: string }>({ active: "turnos", id: "client" })

export function ClientWorkspace({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Tab>("turnos")
  const id = useId()
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1)
      const tab = hash === "precios" ? "turnos" : hash
      if (TABS.some(([key]) => key === tab)) setActive(tab as Tab)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])
  return (
    <Context.Provider value={{ active, id }}>
      <div role="tablist" aria-label="Gestión del cliente" className="flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map(([key, label], index) => (
          <button
            key={key}
            role="tab"
            id={`${id}-${key}-tab`}
            aria-controls={`${id}-${key}`}
            aria-selected={active === key}
            tabIndex={active === key ? 0 : -1}
            type="button"
            onClick={() => setActive(key)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % TABS.length
                  : event.key === "ArrowLeft"
                    ? (index + TABS.length - 1) % TABS.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? TABS.length - 1
                        : null
              if (next === null) return
              event.preventDefault()
              setActive(TABS[next][0])
              document.getElementById(`${id}-${TABS[next][0]}-tab`)?.focus()
            }}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm",
              active === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {children}
    </Context.Provider>
  )
}

export function ClientSection({ tab, children }: { tab: Tab; children: ReactNode }) {
  const { active, id } = useContext(Context)
  return (
    <section
      id={`${id}-${tab}`}
      role="tabpanel"
      aria-labelledby={`${id}-${tab}-tab`}
      hidden={active !== tab}
      tabIndex={0}
      className={active === tab ? "flex flex-col gap-6" : "hidden"}
    >
      {children}
    </section>
  )
}
