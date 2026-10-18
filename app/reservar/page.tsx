import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Booking } from "@/components/booking"
import { Logo } from "@/components/logo"
import { todayArgentina } from "@/lib/admin/format"
import { getUpcomingBlockedDates } from "@/lib/blocked-dates"
import { getVehiclePrices } from "@/lib/prices"

export const revalidate = 60

const title = "Reservar lavado de autos a domicilio en Mendoza | MK Cars"
const description =
  "Reservá online tu lavado premium de autos, SUV o camionetas a domicilio en Gran Mendoza. Elegí día y horario y te confirmamos por WhatsApp."

export const metadata: Metadata = {
  metadataBase: new URL("https://mk-cars-zeta.vercel.app"),
  title,
  description,
  alternates: { canonical: "/reservar" },
  openGraph: {
    title: "MK Cars — Solicitá tu turno",
    description,
    url: "/reservar",
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
    title: "MK Cars — Solicitá tu turno",
    description,
    images: ["/images/og-reservar.png"],
  },
}

export default async function ReservarPage() {
  const [prices, blockedDates] = await Promise.all([getVehiclePrices(), getUpcomingBlockedDates(todayArgentina())])
  return (
    <main className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] text-center md:px-8 md:pb-10 md:pt-10">
        <Link href="/" aria-label="Ir a la página principal de MK Cars">
          <Logo className="w-[170px] md:w-[220px]" />
        </Link>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Lavado premium a domicilio</p>
          <h1 className="text-balance text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-4xl md:text-5xl">
            Solicitá tu turno
          </h1>
          <p className="max-w-md text-pretty text-[0.95rem] leading-relaxed text-muted-foreground">
            Tu auto impecable, sin salir de casa. Te confirmamos por WhatsApp.
          </p>
        </div>
      </header>

      <Booking prices={prices} blockedDates={blockedDates.map((b) => b.day)} standalone />

      <footer className="flex justify-center px-5 pb-10">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Conocé más sobre MK Cars
        </Link>
      </footer>
    </main>
  )
}
