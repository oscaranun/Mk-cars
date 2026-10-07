import Image from "next/image"
import { ArrowRight, MapPin } from "lucide-react"
import { VEHICLES, formatARS } from "@/lib/site"

export function Hero() {
  return (
    <section id="inicio" className="relative isolate flex min-h-svh flex-col overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Image
          src="/images/hero-premium.png"
          alt="Auto negro de alta gama siendo lavado a domicilio al atardecer"
          fill
          priority
          sizes="100vw"
          className="animate-hero-zoom object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-5 pb-10 pt-28 md:px-8 md:pb-16">
        <p
          className="animate-fade-up mb-6 flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.3em] text-silver"
          style={{ animationDelay: "200ms" }}
        >
          <span className="h-px w-8 bg-silver/60" aria-hidden="true" />
          Lavado a domicilio · Gran Mendoza
        </p>

        <h1
          className="animate-fade-up text-balance text-[3.25rem] font-medium leading-[0.95] tracking-[-0.055em] sm:text-7xl md:text-8xl"
          style={{ animationDelay: "350ms" }}
        >
          Lavado premium.
          <span className="block text-silver/70">Donde estés.</span>
        </h1>

        <p
          className="animate-fade-up mt-6 max-w-sm text-pretty text-base leading-relaxed text-foreground/75 md:max-w-md md:text-lg"
          style={{ animationDelay: "500ms" }}
        >
          Llevamos el lavado profesional hasta tu casa o tu trabajo. Vos seguís con tu día, nosotros nos ocupamos de tu
          auto.
        </p>

        <div
          className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: "650ms" }}
        >
          <a
            href="#reservar"
            className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-foreground px-7 text-base font-medium text-background transition-transform active:scale-[0.98]"
          >
            Reservar lavado
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
          <a
            href="#cobertura"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-foreground/25 bg-background/30 px-7 text-base font-medium backdrop-blur-md transition-colors hover:bg-foreground/10"
          >
            <MapPin className="size-4" aria-hidden="true" />
            Consultar cobertura
          </a>
        </div>

        <ul
          className="animate-fade-up mt-10 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-surface/60 backdrop-blur-xl"
          style={{ animationDelay: "800ms" }}
          aria-label="Precios"
        >
          {VEHICLES.map((v) => (
            <li key={v.id} className="flex flex-col gap-1 px-3 py-4 sm:px-6 sm:py-5">
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">{v.name}</span>
              <span className="text-[0.65rem] text-muted-foreground/80">desde</span>
              <span className="text-lg font-medium tracking-tight tabular-nums sm:text-2xl">{formatARS(v.price)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
