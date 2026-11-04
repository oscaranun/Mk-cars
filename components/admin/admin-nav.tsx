"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Calculator,
  CalendarDays,
  CalendarRange,
  MapPinned,
  ClipboardCheck,
  FlaskConical,
  LayoutDashboard,
  MessagesSquare,
  RefreshCcw,
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
  "agenda-servicios": CalendarDays,
  zonas: MapPinned,
  turnos: CalendarDays,
  clientes: Users,
  recontactar: RefreshCcw,
  consultas: MessagesSquare,
  servicios: ClipboardCheck,
  cobros: Wallet,
  caja: Calculator,
  estadisticas: BarChart3,
  pruebas: FlaskConical,
  usuarios: ShieldCheck,
}

const ITEMS = [...SECTIONS, USERS_SECTION]

export function AdminNav({ allowed }: { allowed: string[] }) {
  const pathname = usePathname()
  const items = ITEMS.filter((item) => allowed.includes(item.key))

  return (
    <nav aria-label="Secciones del panel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:px-0">
      <ul className="flex gap-1.5 lg:flex-col">
        {items.map(({ key, href, label }) => {
          const Icon = ICONS[key] ?? LayoutDashboard
          const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition lg:rounded-2xl",
                  active
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-sky hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active ? "text-white" : "text-electric")} aria-hidden="true" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
