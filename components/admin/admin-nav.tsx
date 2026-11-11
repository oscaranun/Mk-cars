"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRight,
  BarChart3,
  Calculator,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  FileText,
  History,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessagesSquare,
  Navigation,
  Receipt,
  RefreshCcw,
  Repeat,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { NAV_GROUPS, SECTIONS, USERS_SECTION, type NavGroup } from "@/lib/admin/permissions"
import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = {
  hoy: LayoutDashboard,
  tablero: KanbanSquare,
  agenda: CalendarRange,
  recorrido: Navigation,
  tareas: ListChecks,
  turnos: CalendarDays,
  clientes: Users,
  recontactar: RefreshCcw,
  campanas: Megaphone,
  consultas: MessagesSquare,
  servicios: FileText,
  movimientos: ArrowLeftRight,
  cobros: Wallet,
  caja: Calculator,
  "gastos-fijos": Repeat,
  cierre: ClipboardCheck,
  estadisticas: BarChart3,
  configuracion: Settings2,
  actividad: History,
  usuarios: ShieldCheck,
  precios: Receipt,
}

type Item = (typeof SECTIONS)[number]

const NESTED_UNDER: Record<string, string[]> = {
  "/admin": ["/admin/consultas", "/admin/tareas"],
  "/admin/agenda": ["/admin/turnos", "/admin/tablero"],
  "/admin/clientes": ["/admin/recontactar", "/admin/campanas"],
  "/admin/movimientos": ["/admin/cobros", "/admin/caja", "/admin/gastos-fijos", "/admin/cierre", "/admin/estadisticas", "/admin/servicios"],
  "/admin/configuracion": [USERS_SECTION.href, "/admin/precios", "/admin/zonas", "/admin/agenda-servicios", "/admin/pruebas"],
}

function matches(href: string, pathname: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)
}

function isActive(href: string, pathname: string) {
  return matches(href, pathname) || (NESTED_UNDER[href] ?? []).some((nested) => matches(nested, pathname))
}

const linkClass = (active: boolean) =>
  cn(
    "flex min-h-10 w-full items-center gap-3 rounded-full px-4 text-sm font-medium transition lg:rounded-2xl",
    active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-sky hover:text-foreground",
  )

function NavLink({ item, active, count }: { item: Item; active: boolean; count?: number }) {
  const Icon = ICONS[item.key] ?? LayoutDashboard
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
      <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-electric")} aria-hidden="true" />
      <span className="whitespace-nowrap">{item.label}</span>
      {count ? (
        <span
          className={cn(
            "ml-auto min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums",
            active ? "bg-white/20 text-white" : "bg-primary/15 text-electric",
          )}
        >
          <span className="sr-only">: </span>
          {count}
          <span className="sr-only"> pendientes</span>
        </span>
      ) : null}
    </Link>
  )
}

export function AdminNav({ allowed, counts = {} }: { allowed: string[]; counts?: Record<string, number> }) {
  const pathname = usePathname()
  const visible = SECTIONS.filter((item) => !item.hidden && allowed.includes(item.key))
  // Keep existing permission grants: staff without Movimientos enters the first finance view they can access.
  if (!allowed.includes("movimientos")) {
    const finance = SECTIONS.find((item) => item.group === "finanzas" && allowed.includes(item.key))
    if (finance) visible.splice(Math.max(0, visible.findIndex((item) => item.key === "configuracion")), 0, { ...finance, label: "Finanzas", hidden: false })
  }
  if (visible.length === 0) {
    const fallback = SECTIONS.find((item) => allowed.includes(item.key) && !["zonas", "recorrido", "agenda-servicios", "pruebas"].includes(item.key))
    if (fallback) visible.push(fallback)
  }
  const activeGroup = visible.find((i) => isActive(i.href, pathname))?.group
  const [closed, setClosed] = useState<Partial<Record<NavGroup, boolean>>>({})

  return (
    <nav
      aria-label="Secciones del panel"
      className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:px-0"
    >
      <ul className="flex gap-1.5 lg:flex-col lg:gap-3">
        {NAV_GROUPS.map((group) => {
          const items = visible.filter((i) => i.group === group.key)
          if (items.length === 0) return null
          const expanded = group.key === activeGroup || !closed[group.key]
          const listId = `nav-${group.key}`
          return (
            <li key={group.key} className="contents lg:flex lg:flex-col lg:gap-1">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => setClosed((c) => ({ ...c, [group.key]: expanded }))}
                className="hidden items-center justify-between px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground lg:flex"
              >
                {group.label}
                <ChevronDown className={cn("size-3.5 transition", expanded && "rotate-180")} aria-hidden="true" />
              </button>
              <ul id={listId} className={cn("contents lg:flex-col lg:gap-1", expanded ? "lg:flex" : "lg:hidden")}>
                {items.map((item) => (
                  <li key={item.key} className="shrink-0">
                    <NavLink item={item} active={isActive(item.href, pathname)} count={counts[item.key]} />
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
