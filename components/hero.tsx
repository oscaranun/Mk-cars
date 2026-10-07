import Image from "next/image"
import { ArrowDown, Clock, MapPin } from "lucide-react"
import { DEFAULT_WHATSAPP_MESSAGE, SERVICE_DAYS, SERVICE_HOURS, whatsappUrl } from "@/lib/site"
import { WhatsAppIcon } from "./whatsapp-icon"

export function Hero() {
  return (
    <section id="inicio" className="relative isolate flex min-h-svh flex-col overflow-hidden bg-inverse text-inverse-foreground">
      <Image
        src="/images/hero.png"
        alt="Auto negro brillante cubierto de gotas de agua después del lavado"
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover opacity-70"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-inverse/60 via-inverse/30 to-inverse" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-5 pb-10 pt-28 md:pb-20">
        <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-inverse-muted">
          <MapPin className="size-3.5" aria-hidden="true" />
          Gran Mendoza · A domicilio
        </p>
        <h1 className="text-balance text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl md:text-8xl">
          Tu auto impecable, sin salir de casa.
        </h1>
        <p className="mt-6 max-w-md text-pretty text-base leading-relaxed text-inverse-muted md:text-lg">
          Lavado premium a domicilio. Vamos a tu casa u oficina con todo el equipo, con agua propia o la tuya.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={whatsappUrl(DEFAULT_WHATSAPP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-inverse-foreground px-7 text-base font-medium text-inverse transition-opacity hover:opacity-90"
          >
            <WhatsAppIcon className="size-5" />
            Reservar por WhatsApp
          </a>
          <a
            href="#servicios"
            className="flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/25 px-7 text-base font-medium transition-colors hover:bg-white/10"
          >
            Ver precios
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </div>

        <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-inverse-muted">Desde</dt>
            <dd className="mt-1 text-lg font-semibold tracking-tight md:text-2xl">$25.000</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-inverse-muted">{SERVICE_DAYS.short}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-lg font-semibold tracking-tight md:text-2xl">
              <Clock className="hidden size-4 sm:block" aria-hidden="true" />
              {SERVICE_HOURS.open}–{SERVICE_HOURS.close}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-inverse-muted">Zonas</dt>
            <dd className="mt-1 text-lg font-semibold tracking-tight md:text-2xl">6 dptos.</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
