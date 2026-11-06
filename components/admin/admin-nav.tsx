"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  Calculator,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  FileText,
  LayoutDashboard,
  MessagesSquare,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { SECTIONS, USERS_SECTION } from "@/lib/admin/permissions"
import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = {
  hoy: LayoutDashboard,
  agenda: CalendarRange,
  turnos: CalendarDays,
  clientes: Users,
  recontactar: RefreshCcw,
  consultas: MessagesSquare,
  servicios: FileText,
  movimientos: ArrowLeftRight,
  cobros: Wallet,
  caja: Calculator,
  estadisticas: BarChart3,
  configuracion: Settings2,
  usuarios: ShieldCheck,
}

type Item = { key: string; href: string; label: string; group?: "admin"; hidden?: boolean }

const ITEMS: Item[] = [...SECTIONS]

const NESTED_UNDER: Record<string, string[]> = { "/admin/configuracion": [USERS_SECTION.href] }

function matches(href: string, pathname: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)
}

function isActive(href: string, pathname: string) {
  return matches(href, pathname) || (NESTED_UNDER[href] ?? []).some((nested) => matches(nested, pathname))
}

const linkClass = (active: boolean) =>
  cn(
    "flex min-h-11 w-full items-center gap-3 rounded-full px-4 text-sm font-medium transition lg:rounded-2xl",
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
  const visible = ITEMS.filter((item) => !item.hidden && allowed.includes(item.key))
  const adminItems = visible.filter((i) => i.group === "admin")
  const adminActive = adminItems.some((i) => isActive(i.href, pathname))
  const [open, setOpen] = useState(adminActive)
  const expanded = open || adminActive

  const top = visible.filter((i) => !i.group)
  const firstAfterAdmin = top.findIndex((i) => i.key === "clientes")
  const before = firstAfterAdmin === -1 ? top : top.slice(0, firstAfterAdmin)
  const after = firstAfterAdmin === -1 ? [] : top.slice(firstAfterAdmin)

  const renderItem = (item: Item) => (
    <li key={item.key} className="shrink-0">
      <NavLink item={item} active={isActive(item.href, pathname)} count={counts[item.key]} />
    </li>
  )

  return (
    <nav aria-label="Secciones del panel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:px-0">
      <ul className="flex gap-1.5 lg:flex-col">
        {before.map(renderItem)}
        {adminItems.length > 0 && (
          <li className="shrink-0 lg:flex lg:flex-col lg:gap-1.5">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls="nav-administracion"
              onClick={() => setOpen((v) => !v)}
              className={linkClass(false)}
            >
              <Briefcase className="size-4 shrink-0 text-electric" aria-hidden="true" />
              <span className="whitespace-nowrap">Administración</span>
              <ChevronDown className={cn("ml-auto size-4 transition", expanded && "rotate-180")} aria-hidden="true" />
            </button>
            {expanded && (
              <ul id="nav-administracion" className="hidden flex-col gap-1.5 lg:ml-4 lg:flex lg:border-l lg:border-border lg:pl-2">
                {adminItems.map(renderItem)}
              </ul>
            )}
          </li>
        )}
        {expanded &&
          adminItems.map((item) => (
            <li key={`m-${item.key}`} className="shrink-0 lg:hidden">
              <NavLink item={item} active={isActive(item.href, pathname)} count={counts[item.key]} />
            </li>
          ))}
        {after.map(renderItem)}
      </ul>
    </nav>
  )
}
