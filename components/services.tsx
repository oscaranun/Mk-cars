import { ArrowUpRight, Check, Droplets } from "lucide-react"
import { VEHICLES, formatARS, whatsappUrl } from "@/lib/site"
import { SectionHeading } from "./section-heading"

const INCLUDED = [
  "Lavado exterior a mano",
  "Llantas y neumáticos",
  "Aspirado interior completo",
  "Limpieza de tablero y paneles",
  "Vidrios interior y exterior",
  "Secado con microfibra",
]

export function Services() {
  return (
    <section aria-labelledby="servicios-title" id="servicios" className="bg-background py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          id="servicios-title"
          eyebrow="01 — Servicios"
          title="Un solo lavado. Completo."
          description="El precio depende del tamaño de tu vehículo. Sin extras sorpresa: todo lo que necesita tu auto, incluido."
        />

        <ul className="mt-12 flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4">
          {VEHICLES.map((vehicle, index) => {
            const featured = index === 1
            return (
              <li key={vehicle.id}>
                <a
                  href={whatsappUrl(`Hola MK Cars, quiero reservar un lavado para mi ${vehicle.name} (${formatARS(vehicle.price)}).`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex h-full flex-col justify-between gap-8 rounded-3xl border p-6 transition-colors md:p-8 ${
                    featured
                      ? "border-inverse bg-inverse text-inverse-foreground"
                      : "border-border bg-white hover:border-foreground"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">{vehicle.name}</h3>
                      <p className={`mt-1 text-sm ${featured ? "text-inverse-muted" : "text-muted-foreground"}`}>
                        {vehicle.detail}
                      </p>
                    </div>
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full border transition-transform group-hover:rotate-45 ${
                        featured ? "border-white/20" : "border-border"
                      }`}
                      aria-hidden="true"
                    >
                      <ArrowUpRight className="size-5" />
                    </span>
                  </div>
                  <div>
                    <p className="text-5xl font-semibold tracking-tight">{formatARS(vehicle.price)}</p>
                    <p className={`mt-2 text-sm ${featured ? "text-inverse-muted" : "text-muted-foreground"}`}>
                      Reservar este servicio
                    </p>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 flex flex-col gap-8 rounded-3xl bg-muted p-6 md:flex-row md:p-10">
          <div className="md:w-1/3">
            <h3 className="text-xl font-semibold tracking-tight">Qué incluye</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">En todos los vehículos, sin excepción.</p>
          </div>
          <ul className="grid flex-1 grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex items-start gap-4 rounded-3xl border border-border p-6 md:items-center md:p-8">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-inverse text-inverse-foreground">
            <Droplets className="size-5" aria-hidden="true" />
          </span>
          <p className="text-pretty text-base leading-relaxed">
            <strong className="font-semibold">Agua propia o la tuya.</strong>{" "}
            <span className="text-muted-foreground">
              Llevamos nuestro tanque de agua, o si preferís, usamos la canilla de tu casa. Vos elegís al reservar.
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
