import { CalendarCheck, Car, Sparkles } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"
import { SERVICE_DAYS, SERVICE_HOURS } from "@/lib/site"

const STEPS = [
  {
    icon: CalendarCheck,
    title: "Reservás",
    text: `Elegís día y horario. ${SERVICE_DAYS.full} de ${SERVICE_HOURS.open} a ${SERVICE_HOURS.close}.`,
  },
  { icon: Car, title: "Vamos a tu ubicación", text: "Llegamos a tu casa o trabajo con todo el equipo." },
  { icon: Sparkles, title: "Tu auto, impecable", text: "Lo dejamos listo sin que tengas que moverte." },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-36">
      <SectionHeading index="01" eyebrow="Cómo funciona" title="Tres pasos. Cero traslados." />

      <ol className="mt-14 flex flex-col md:mt-20 md:flex-row md:gap-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative flex-1">
            <Reveal delay={i * 120} className="flex gap-5 pb-10 md:flex-col md:pb-0">
              <div className="flex flex-col items-center md:flex-row">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                  <step.icon className="size-5 text-silver" aria-hidden="true" />
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className="mt-3 w-px flex-1 bg-gradient-to-b from-border to-transparent md:ml-4 md:mt-0 md:h-px md:w-auto md:bg-gradient-to-r"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2 pt-2.5 md:pt-6">
                <span className="font-mono text-[0.7rem] tracking-[0.2em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-2xl font-medium tracking-tight">{step.title}</h3>
                <p className="max-w-xs text-pretty leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  )
}
