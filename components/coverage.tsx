import { MapPin, MessageCircle } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { COVERAGE_ZONES, whatsappUrl } from "@/lib/site"

export function Coverage() {
  return (
    <section id="cobertura" aria-label="Cobertura" className="mx-auto max-w-6xl px-5 pt-10 md:px-8 md:pt-14">
      <Reveal>
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky text-primary">
              <MapPin className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold tracking-tight md:text-base">Lavamos en todo el Gran Mendoza</p>
              <ul
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground md:text-sm"
                aria-label="Departamentos con cobertura"
              >
                {COVERAGE_ZONES.map((zone, i) => (
                  <li key={zone} className="flex items-center gap-2">
                    {i > 0 && (
                      <span aria-hidden="true" className="text-muted-foreground/50">
                        {"·"}
                      </span>
                    )}
                    {zone}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <a
            href={whatsappUrl("Hola MK Cars, ¿llegan a mi zona?")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-full px-1 text-sm font-medium text-primary transition-opacity hover:opacity-80 md:self-auto"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            ¿Otra zona? Consultanos
          </a>
        </div>
      </Reveal>
    </section>
  )
}
