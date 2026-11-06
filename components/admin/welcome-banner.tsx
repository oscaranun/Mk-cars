import Link from "next/link"
import { History } from "lucide-react"
import { secondaryButtonClass } from "@/components/admin/ui"

function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("es-AR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" }).format(now),
  )
  if (hour < 12) return "Buen día"
  if (hour < 20) return "Buenas tardes"
  return "Buenas noches"
}

export function WelcomeBanner({ name, changesToday, now }: { name: string; changesToday: number; now: Date }) {
  return (
    <section
      aria-labelledby="welcome-name"
      className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-soft md:flex-row md:items-end md:justify-between md:p-8"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm text-muted-foreground">{greeting(now)},</p>
        <h1 id="welcome-name" className="text-balance text-4xl font-bold uppercase tracking-tight text-foreground md:text-5xl lg:text-6xl">
          {name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {changesToday === 0
            ? "Todavía no registraste cambios hoy."
            : `Hoy registraste ${changesToday} ${changesToday === 1 ? "cambio" : "cambios"} en el panel.`}
        </p>
      </div>
      <Link href="/admin/actividad?usuario=yo" className={`${secondaryButtonClass} shrink-0`}>
        <History className="size-4" aria-hidden="true" />
        Ver mis cambios
      </Link>
    </section>
  )
}
