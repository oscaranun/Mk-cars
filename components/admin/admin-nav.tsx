"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, CalendarDays, ClipboardCheck, LayoutDashboard, MessagesSquare, Users, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/consultas", label: "Consultas", icon: MessagesSquare },
  { href: "/admin/turnos", label: "Turnos", icon: CalendarDays },
  { href: "/admin/servicios", label: "Servicios", icon: ClipboardCheck },
  { href: "/admin/cobros", label: "Cobros", icon: Wallet },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: BarChart3 },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Secciones del panel" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1.5 lg:flex-col">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
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
