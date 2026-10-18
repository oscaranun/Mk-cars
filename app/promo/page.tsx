import type { Metadata, Viewport } from "next"
import Image from "next/image"
import Link from "next/link"
import { MapPin } from "lucide-react"

const title = "MK Cars — Lavado premium a domicilio en Gran Mendoza"
const description = "Tu auto impecable, sin salir de casa. Solicitá tu turno en un minuto y te confirmamos por WhatsApp."

export const metadata: Metadata = {
  metadataBase: new URL("https://mk-cars-zeta.vercel.app"),
  title,
  description,
  alternates: { canonical: "/promo" },
  openGraph: {
    title: "MK Cars — Tu auto impecable, sin salir de casa",
    description,
    url: "/promo",
    siteName: "MK Cars",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "/images/og-reservar.png",
        width: 1200,
        height: 630,
        alt: "MK Cars — Lavado premium a domicilio en Gran Mendoza",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MK Cars — Tu auto impecable, sin salir de casa",
    description,
    images: ["/images/og-reservar.png"],
  },
}

export const viewport: Viewport = {
  themeColor: "#061633",
}

export default function PromoPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-[radial-gradient(ellipse_at_top,#0d3f86_0%,#082457_40%,#04122e_100%)] px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-white">
      <div className="flex w-full max-w-md flex-col items-center gap-7 text-center md:max-w-xl md:gap-8">
        <div className="rounded-3xl bg-white px-6 py-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]">
          <Image
            src="/images/mk-logo-hd2.png"
            alt="MK Car Wash Premium a domicilio"
            width={1074}
            height={467}
            priority
            className="h-auto w-[180px] md:w-[220px]"
          />
        </div>

        <p className="rounded-full border border-[#2d7ff0]/60 px-5 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-[#4a9bff] md:text-xs">
          Lavado premium a domicilio
        </p>

        <h1 className="text-balance text-[2.25rem] font-bold leading-[1.05] tracking-[-0.035em] md:text-5xl">
          Tu auto impecable,
          <span className="block text-[#6cb4ff]">sin salir de casa</span>
        </h1>

        <div className="w-full overflow-hidden rounded-3xl border border-white/15 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <Image
            src="/images/mk-van.webp"
            alt="Utilitario Peugeot Partner de MK Car Wash a domicilio"
            width={762}
            height={460}
            priority
            sizes="(min-width: 768px) 576px, 100vw"
            className="h-auto w-full"
          />
        </div>

        <p className="flex items-center gap-2 text-base text-white/90 md:text-lg">
          <MapPin className="size-5 shrink-0 text-[#4a9bff]" aria-hidden="true" />
          Llegamos a todo el Gran Mendoza
        </p>

        <Link
          href="/reservar?origen=whatsapp_flyer"
          className="inline-flex min-h-14 w-full max-w-sm items-center justify-center rounded-full bg-[#1677f0] px-8 text-lg font-bold uppercase tracking-[0.08em] text-white shadow-[0_0_40px_-5px_rgba(22,119,240,0.8)] transition-colors hover:bg-[#2b88ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6cb4ff]/60 md:text-xl"
        >
          Solicitá tu turno
        </Link>

        <p className="text-sm text-white/60">Reservá en un minuto. Te confirmamos por WhatsApp.</p>
      </div>
    </main>
  )
}
