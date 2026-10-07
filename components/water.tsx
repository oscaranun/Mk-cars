import Image from "next/image"
import { Droplets, House } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"

const OPTIONS = [
  {
    icon: Droplets,
    label: "Opción A",
    title: "Agua propia",
    text: "Llegamos con nuestra propia reserva de agua. No necesitás una canilla cerca.",
  },
  {
    icon: House,
    label: "Opción B",
    title: "Agua del domicilio",
    text: "Si tenés agua corriente disponible, la usamos para el lavado.",
  },
]

export function Water() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-36">
      <div className="grid gap-14 md:grid-cols-2 md:items-center md:gap-16">
        <div className="flex flex-col gap-12">
          <SectionHeading
            index="03"
            eyebrow="Vamos preparados"
            title="Con agua o sin agua en tu casa."
            description="Nos adaptamos a tu domicilio. Vos elegís cómo trabajamos."
          />
          <ul className="flex flex-col gap-3">
            {OPTIONS.map((o, i) => (
              <li key={o.title}>
                <Reveal delay={i * 120}>
                  <div className="flex gap-5 rounded-2xl border border-border bg-surface p-5">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                      <o.icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground">
                        {o.label}
                      </span>
                      <h3 className="text-xl font-medium tracking-tight">{o.title}</h3>
                      <p className="text-pretty leading-relaxed text-muted-foreground">{o.text}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <Reveal className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border md:order-first">
          <Image
            src="/images/water.png"
            alt="Hidrolavadora profesional rociando agua sobre la carrocería de un auto negro"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </Reveal>
      </div>
    </section>
  )
}
