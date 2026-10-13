import { Check, ChevronDown, Clock } from "lucide-react"

const INCLUDED = [
  "Lavado de carrocería",
  "Limpieza de llantas",
  "Renovador de neumáticos",
  "Aspirado interior y baúl",
  "Tablero y paneles",
  "Vidrios interiores y exteriores",
  "Secado y terminación",
  "Aromatización opcional",
]

export function ServiceIncludes() {
  return (
    <details className="group rounded-2xl border border-border bg-surface/60 open:bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-sm font-medium text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 [&::-webkit-details-marker]:hidden">
        ¿Qué incluye el Lavado Completo Premium?
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="flex flex-col gap-4 px-4 pb-4">
        <p className="text-xs text-muted-foreground">Interior + exterior · A domicilio</p>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-white/85">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-2.5 border-t border-border pt-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-white">
            Duración estimada: 40–60 min por vehículo
            <span className="block text-xs text-muted-foreground">Sujeto al tamaño y estado del vehículo</span>
          </p>
        </div>
      </div>
    </details>
  )
}
