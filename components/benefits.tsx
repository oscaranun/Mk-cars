import { Clock, Droplets, MapPin, ShieldCheck } from "lucide-react"
import { Reveal } from "@/components/reveal"

const BENEFITS = [
  { icon: Clock, title: "Ahorrás tiempo", text: "Sin filas ni traslados." },
  { icon: MapPin, title: "Donde estés", text: "Casa, oficina o edificio." },
  { icon: ShieldCheck, title: "Productos premium", text: "Cuidado real de la pintura." },
  { icon: Droplets, title: "Con o sin agua", text: "Nos adaptamos a tu lugar." },
]

export function Benefits() {
  return (
    <section aria-label="Beneficios" className="mx-auto max-w-6xl px-5 pt-4 pb-12 md:px-8 md:pb-20">
      <Reveal>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl border border-border bg-card px-5 py-5 md:grid-cols-4 md:gap-0 md:divide-x md:divide-border md:px-0">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex items-start gap-3 md:px-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky text-primary">
                <b.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold tracking-tight">{b.title}</h3>
                <p className="text-xs leading-snug text-muted-foreground md:text-sm">{b.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}
