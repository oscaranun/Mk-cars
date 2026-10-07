import { CalendarCheck, Sparkles } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"
import { VehicleLineIcon } from "@/components/vehicle-line-icon"
import { SERVICE_DAYS, SERVICE_HOURS } from "@/lib/site"

const STEPS = [
  {
    icon: <CalendarCheck className="size-14" strokeWidth={1.25} aria-hidden="true" />,
    title: "Reservás",
    text: `${SERVICE_DAYS.full}, ${SERVICE_HOURS.open} a ${SERVICE_HOURS.close}.`,
  },
  {
    icon: <VehicleLineIcon id="suv" />,
    title: "Vamos a vos",
    text: "A tu casa o trabajo, con todo el equipo.",
  },
  {
    icon: <Sparkles className="size-14" strokeWidth={1.25} aria-hidden="true" />,
    title: "Listo",
    text: "Tu auto impecable, sin moverte.",
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-28">
      <SectionHeading eyebrow="Cómo funciona" title="Tres pasos. Cero traslados." />

      <ol className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <Reveal delay={i * 100}>
              <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-7">
                <span className="relative flex h-16 w-fit items-end text-primary">
                  {step.icon}
                  <span className="absolute -right-4 -top-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-2xl font-semibold tracking-tight">{step.title}</h3>
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
