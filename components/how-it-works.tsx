import { CalendarCheck, Sparkles } from "lucide-react"
import { VehicleLineIcon } from "@/components/vehicle-line-icon"
import { SERVICE_DAYS, SERVICE_HOURS } from "@/lib/site"

const STEPS = [
  {
    icon: <CalendarCheck className="size-7" strokeWidth={1.5} aria-hidden="true" />,
    title: "Reservás",
    text: `${SERVICE_DAYS.full}, ${SERVICE_HOURS.open} a ${SERVICE_HOURS.close}.`,
  },
  {
    icon: <VehicleLineIcon id="suv" width={64} />,
    title: "Vamos a vos",
    text: "A tu casa o trabajo, con todo el equipo.",
  },
  {
    icon: <Sparkles className="size-7" strokeWidth={1.5} aria-hidden="true" />,
    title: "Listo",
    text: "Tu auto impecable, sin moverte.",
  },
]

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-title"
      className="scroll-mt-28 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur md:p-5"
    >
      <h2 id="como-funciona-title" className="text-xs font-medium uppercase tracking-wider text-electric">
        Cómo funciona
      </h2>
      <ol className="mt-3 grid grid-cols-3 gap-3 md:gap-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-2">
            <span className="relative flex h-8 w-fit items-end text-electric">
              {step.icon}
              <span className="absolute -right-3 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-semibold text-primary-foreground">
                {i + 1}
              </span>
            </span>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold tracking-tight text-white">{step.title}</h3>
              <p className="text-pretty text-xs leading-snug text-white/60">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
