import { CalendarCheck, Car, Sparkles } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"
import { SERVICE_DAYS, SERVICE_HOURS } from "@/lib/site"

const STEPS = [
  { icon: CalendarCheck, title: "Reservás", text: `${SERVICE_DAYS.full}, ${SERVICE_HOURS.open} a ${SERVICE_HOURS.close}.` },
  { icon: Car, title: "Vamos a vos", text: "A tu casa o trabajo, con todo el equipo." },
  { icon: Sparkles, title: "Listo", text: "Tu auto impecable, sin moverte." },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-28">
      <SectionHeading eyebrow="Cómo funciona" title="Tres pasos. Cero traslados." />

      <ol className="mt-10 grid gap-3 md:mt-14 md:grid-cols-3 md:gap-5">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <Reveal delay={i * 100}>
              <div className="flex items-center gap-4 rounded-3xl border border-border bg-white p-5 shadow-soft md:flex-col md:items-start md:gap-6 md:p-7">
                <span className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky text-primary">
                  <step.icon className="size-5" aria-hidden="true" />
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  )
}
