import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"
import { VEHICLES, formatARS, whatsappUrl } from "@/lib/site"

export function Services() {
  return (
    <section id="servicios" className="border-t border-border bg-surface/40 py-24 md:py-36">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <SectionHeading
          index="02"
          eyebrow="Servicios y precios"
          title="Un precio claro para cada vehículo."
          description="Lavado profesional a domicilio. El valor depende del tamaño de tu vehículo."
        />

        <ul className="mt-14 grid gap-4 md:mt-20 md:grid-cols-3 md:gap-5">
          {VEHICLES.map((v, i) => (
            <li key={v.id}>
              <Reveal delay={i * 120}>
                <article className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl border border-border">
                  <Image
                    src={v.image}
                    alt={`${v.name} lavado por MK Cars`}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="-z-10 object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
                  />
                  <div
                    className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-transparent"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-5 p-6">
                    <div>
                      <p className="text-[0.7rem] uppercase tracking-[0.25em] text-silver">{v.detail}</p>
                      <h3 className="mt-2 text-4xl font-medium tracking-[-0.04em]">{v.name}</h3>
                    </div>
                    <div className="flex items-end justify-between gap-4 border-t border-foreground/15 pt-5">
                      <p className="flex flex-col">
                        <span className="text-xs text-muted-foreground">desde</span>
                        <span className="text-3xl font-medium tracking-tight tabular-nums">{formatARS(v.price)}</span>
                      </p>
                      <a
                        href={whatsappUrl(`Hola MK Cars, quiero reservar un lavado para mi ${v.name}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Reservar lavado para ${v.name} por WhatsApp`}
                        className="flex size-12 items-center justify-center rounded-full bg-foreground text-background transition-transform group-hover:rotate-45"
                      >
                        <ArrowUpRight className="size-5" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
