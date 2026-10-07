import { ArrowUpRight, Car, Droplets, Sparkles } from "lucide-react"
import { PickupIcon, SuvIcon } from "@/components/vehicle-icons"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"
import { EXTRAS, VEHICLES, formatARS, whatsappUrl } from "@/lib/site"
import { cn } from "@/lib/utils"

const ICONS = { auto: Car, suv: SuvIcon, pickup: PickupIcon } as const

export function Services() {
  return (
    <section id="servicios" className="bg-celeste py-16 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <SectionHeading eyebrow="Servicios y precios" title="Un precio claro para cada vehículo." />

        <ul className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
          {VEHICLES.map((v, i) => {
            const Icon = ICONS[v.id]
            const featured = v.id === "suv"
            return (
              <li key={v.id}>
                <Reveal delay={i * 100}>
                  <article
                    className={cn(
                      "group relative flex flex-col gap-6 rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1 md:p-7",
                      featured ? "bg-deep text-white shadow-glow" : "border border-border bg-white shadow-soft",
                    )}
                  >
                    {featured && (
                      <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-[0.7rem] font-medium text-white">
                        Más elegido
                      </span>
                    )}
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center rounded-2xl",
                        featured ? "bg-white/10 text-white" : "bg-sky text-primary",
                      )}
                    >
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">{v.name}</h3>
                      <p className={cn("mt-1 text-sm", featured ? "text-white/60" : "text-muted-foreground")}>
                        {v.detail}
                      </p>
                    </div>
                    <div className="flex items-end justify-between gap-4">
                      <p className="flex flex-col">
                        <span className={cn("text-xs", featured ? "text-white/60" : "text-muted-foreground")}>
                          desde
                        </span>
                        <span className="text-4xl font-semibold tracking-[-0.04em] tabular-nums">
                          {formatARS(v.price)}
                        </span>
                      </p>
                      <a
                        href={whatsappUrl(`Hola MK Cars, quiero reservar un lavado para mi ${v.name}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Reservar lavado para ${v.name} por WhatsApp`}
                        className={cn(
                          "flex size-12 shrink-0 items-center justify-center rounded-full transition-transform group-hover:rotate-45",
                          featured ? "bg-white text-deep" : "bg-primary text-primary-foreground",
                        )}
                      >
                        <ArrowUpRight className="size-5" aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                </Reveal>
              </li>
            )
          })}
        </ul>

        <Reveal className="mt-6">
          <p className="flex items-start gap-2 text-sm text-muted-foreground md:max-w-xl">
            <Droplets className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Usamos el agua de tu domicilio. ¿No tenés acceso a agua? MK puede llevarte agua.
            </span>
          </p>
        </Reveal>

        <Reveal className="mt-6">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Servicios adicionales</p>
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-white md:max-w-xl">
            {EXTRAS.map((extra) => (
              <li key={extra.id} className="flex min-h-14 items-center justify-between gap-4 px-4">
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Sparkles className="size-4 text-primary" aria-hidden="true" />
                  {extra.name}
                </span>
                <span className="text-xs text-muted-foreground">Consultar precio</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
