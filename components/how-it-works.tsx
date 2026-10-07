import Image from "next/image"
import { SectionHeading } from "./section-heading"

const STEPS = [
  {
    title: "Escribinos por WhatsApp",
    body: "Contanos tu vehículo, tu zona y el horario que te queda cómodo.",
  },
  {
    title: "Confirmamos el turno",
    body: "Te respondemos con día y hora, de lunes a sábado entre las 9:00 y las 18:00. Elegís agua propia o la tuya.",
  },
  {
    title: "Vamos a donde estés",
    body: "Llegamos a tu casa u oficina con todo el equipo. No tenés que mover el auto.",
  },
  {
    title: "Listo, impecable",
    body: "Revisamos el resultado juntos. Tu auto queda brillante, sin que hayas movido un dedo.",
  },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="como-funciona-title" id="como-funciona" className="bg-inverse py-20 text-inverse-foreground md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          id="como-funciona-title"
          eyebrow="02 — Cómo funciona"
          title="Cuatro pasos. Cero vueltas."
          inverse
        />

        <div className="mt-12 flex flex-col gap-10 md:flex-row md:gap-16">
          <ol className="flex flex-1 flex-col">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-5 border-t border-inverse-border py-6 last:border-b">
                <span className="font-mono text-sm text-inverse-muted">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-pretty leading-relaxed text-inverse-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl md:w-5/12">
            <Image
              src="/images/detail.png"
              alt="Secado a mano con microfibra sobre el capot de un auto"
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
