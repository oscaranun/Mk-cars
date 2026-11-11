"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const FINANCE = [
  ["movimientos", "Movimientos"],
  ["cobros", "Por cobrar e ingresos"],
  ["caja", "Egresos"],
  ["cierre", "Cierre"],
  ["estadisticas", "Informes"],
  ["gastos-fijos", "Gastos fijos"],
  ["servicios", "Servicios realizados"],
] as const
const OPERATIONS = [
  ["consultas", "Solicitudes"],
  ["tablero", "Turnos"],
  ["agenda", "Agenda"],
  ["tareas", "Tareas"],
] as const
const CLIENTS = [
  ["clientes", "Clientes"],
  ["recontactar", "Seguimiento"],
  ["campanas", "Campañas"],
] as const

export function WorkspaceNavigation({ allowed }: { allowed: string[] }) {
  const path = usePathname()
  const current = path.split("/")[2]
  const finance = FINANCE.some(([key]) => key === current)
  const group = finance
    ? FINANCE
    : OPERATIONS.some(([key]) => key === current)
      ? OPERATIONS
      : CLIENTS.some(([key]) => key === current) && path.split("/").length === 3
        ? CLIENTS
        : null
  if (!group) return null
  const links = group.filter(([key]) => allowed.includes(key))
  return (
    <nav
      aria-label={finance ? "Vistas de finanzas" : "Vistas de trabajo"}
      className="flex flex-wrap gap-2 border-b border-border pb-4"
    >
      {links.map(([key, label]) => (
        <Link
          key={key}
          href={`/admin/${key}`}
          aria-current={current === key ? "page" : undefined}
          className={cn(
            "rounded-full border px-4 py-2 text-sm",
            current === key
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
