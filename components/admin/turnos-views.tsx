import Link from "next/link"
import { cn } from "@/lib/utils"

const VIEWS = [
  { key: "lista", href: "/admin/turnos", label: "Lista" },
  { key: "semana", href: "/admin/agenda", label: "Semana" },
  { key: "mes", href: "/admin/turnos/calendario", label: "Mes" },
] as const

export function TurnosViews({ current }: { current: (typeof VIEWS)[number]["key"] }) {
  return (
    <nav aria-label="Vista de turnos" className="flex w-full gap-1 rounded-full border border-border bg-card p-1 sm:w-auto sm:self-start">
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={v.href}
          aria-current={current === v.key ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-medium transition sm:flex-none",
            current === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  )
}
