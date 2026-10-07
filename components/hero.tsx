import Image from "next/image"
import { ArrowRight, Clock, Droplets, MapPin } from "lucide-react"
import { SERVICE_DAYS, SERVICE_HOURS, VEHICLES, formatARS } from "@/lib/site"

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative isolate overflow-hidden rounded-b-[2.5rem] bg-deep pb-14 pt-[19rem] text-white md:rounded-b-[3.5rem] md:pb-24 md:pt-[26rem]"
    >
      <div
        className="absolute -top-32 left-1/2 -z-10 size-[38rem] -translate-x-1/2 rounded-full bg-primary/30 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-primary/15 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-14 md:px-8">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <p
            className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur"
            style={{ animationDelay: "100ms" }}
          >
            <Droplets className="size-3.5 text-electric" aria-hidden="true" />
            Lavado premium a domicilio
          </p>

          <h1
            className="animate-fade-up mt-5 text-balance text-[2.6rem] font-bold leading-[1.02] tracking-[-0.045em] sm:text-6xl md:text-7xl"
            style={{ animationDelay: "200ms" }}
          >
            Tu auto impecable.
            <span className="text-gradient-water block pb-1">Sin moverte de donde estás.</span>
          </h1>

          <p
            className="animate-fade-up mt-4 max-w-sm text-pretty leading-relaxed text-white/65 md:text-lg"
            style={{ animationDelay: "300ms" }}
          >
            Vamos hasta tu casa o trabajo en Gran Mendoza.
          </p>

          <div
            className="animate-fade-up mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            style={{ animationDelay: "400ms" }}
          >
            <a
              href="#reservar"
              className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-glow transition-transform active:scale-[0.98]"
            >
              Reservar lavado
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
            <a
              href="#servicios"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 text-base font-medium text-white transition-colors hover:bg-white/10"
            >
              Ver precios
            </a>
          </div>

          <ul
            className="animate-fade-up mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/60 md:justify-start"
            style={{ animationDelay: "500ms" }}
          >
            <li className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-electric" aria-hidden="true" />
              Gran Mendoza
            </li>
            <li className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-electric" aria-hidden="true" />
              {SERVICE_DAYS.short} {SERVICE_HOURS.open} – {SERVICE_HOURS.close}
            </li>
          </ul>
        </div>

        <div className="animate-fade-up relative" style={{ animationDelay: "350ms" }}>
          <div className="relative aspect-[762/460] overflow-hidden rounded-[1.75rem] bg-white/5 shadow-2xl shadow-black/40 ring-1 ring-white/10">
            <Image
              src="/images/mk-van.webp"
              alt="Camioneta de MK Car Wash ploteada con el logo, WhatsApp e Instagram de la marca"
              fill
              priority
              sizes="(min-width: 768px) 55vw, 100vw"
              className="animate-hero-zoom object-cover"
            />
          </div>

          <div className="animate-float absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 text-deep shadow-soft">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#e8f4ff] text-primary">
              <Droplets className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-[0.7rem] text-slate-500">Desde</span>
              <span className="text-sm font-bold tabular-nums">{formatARS(VEHICLES[0].price)}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
