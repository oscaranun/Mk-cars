import Image from "next/image"
import { ArrowRight, Clock, MapPin, Sparkles } from "lucide-react"
import { SERVICE_DAYS, SERVICE_HOURS, VEHICLES, formatARS } from "@/lib/site"

export function Hero() {
  return (
    <section id="inicio" className="relative isolate overflow-hidden pb-16 pt-24 md:pb-24 md:pt-32">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-gradient-to-b from-sky via-sky/50 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-14 md:px-8">
        <div className="flex flex-col items-start">
          <p
            className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-sky-strong bg-white px-3 py-1.5 text-xs font-medium text-primary"
            style={{ animationDelay: "100ms" }}
          >
            <MapPin className="size-3.5" aria-hidden="true" />
            Lavado a domicilio · Gran Mendoza
          </p>

          <h1
            className="animate-fade-up mt-5 text-balance text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl md:text-7xl"
            style={{ animationDelay: "200ms" }}
          >
            Tu auto impecable.
            <span className="block text-primary">Sin moverte de donde estás.</span>
          </h1>

          <p
            className="animate-fade-up mt-5 max-w-sm text-pretty leading-relaxed text-muted-foreground md:text-lg"
            style={{ animationDelay: "300ms" }}
          >
            Vamos a tu casa o trabajo con todo el equipo.
          </p>

          <div
            className="animate-fade-up mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            style={{ animationDelay: "400ms" }}
          >
            <a
              href="#reservar"
              className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-glow transition-transform active:scale-[0.98]"
            >
              Reservar lavado
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <a
              href="#servicios"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-border bg-white px-8 text-base font-medium text-deep transition-colors hover:border-sky-strong hover:bg-sky"
            >
              Ver precios
            </a>
          </div>
        </div>

        <div className="animate-fade-up relative" style={{ animationDelay: "350ms" }}>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-sky shadow-soft md:aspect-[4/5]">
            <Image
              src="/images/hero-light.png"
              alt="SUV blanca recién lavada a domicilio, con gotas de agua sobre la carrocería"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="animate-hero-zoom object-cover object-[center_70%]"
            />
          </div>

          <div className="animate-float absolute -left-2 top-6 flex items-center gap-3 rounded-2xl bg-white/95 p-3 pr-4 shadow-soft backdrop-blur sm:-left-6">
            <span className="flex size-9 items-center justify-center rounded-xl bg-sky text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-[0.7rem] text-muted-foreground">Desde</span>
              <span className="text-sm font-semibold tabular-nums">{formatARS(VEHICLES[0].price)}</span>
            </span>
          </div>

          <div
            className="animate-float absolute -right-2 bottom-6 flex items-center gap-3 rounded-2xl bg-white/95 p-3 pr-4 shadow-soft backdrop-blur sm:-right-6"
            style={{ animationDelay: "1.5s" }}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Clock className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-[0.7rem] text-muted-foreground">{SERVICE_DAYS.short}</span>
              <span className="text-sm font-semibold tabular-nums">
                {SERVICE_HOURS.open} – {SERVICE_HOURS.close}
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
