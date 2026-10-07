import { Clock, Droplets, MapPin, ShieldCheck } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"

const BENEFITS = [
  { icon: Clock, title: "Ahorrás tiempo", text: "Sin filas ni traslados." },
  { icon: MapPin, title: "Donde estés", text: "Casa, oficina o edificio." },
  { icon: ShieldCheck, title: "Productos premium", text: "Cuidado real de la pintura." },
  { icon: Droplets, title: "Con o sin agua", text: "Nos adaptamos a tu lugar." },
]

export function Benefits() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-28">
      <SectionHeading eyebrow="Beneficios" title="Más cómodo. Más cuidado." />

      <ul className="mt-10 grid grid-cols-2 gap-3 md:mt-14 md:grid-cols-4 md:gap-5">
        {BENEFITS.map((b, i) => (
          <li key={b.title}>
            <Reveal delay={i * 80} className="h-full">
              <div className="flex h-full flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-sky text-primary">
                  <b.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold tracking-tight">{b.title}</h3>
                  <p className="text-sm leading-snug text-muted-foreground">{b.text}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  )
}
