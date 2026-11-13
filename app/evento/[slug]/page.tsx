import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react"
import { Booking } from "@/components/booking"
import { Logo } from "@/components/logo"
import { todayArgentina } from "@/lib/admin/format"
import { getUpcomingBlockedDates } from "@/lib/blocked-dates"
import { formatEventDate, getEventBySlug, isEventOver } from "@/lib/events"
import { getVehiclePrices } from "@/lib/prices"
import { getZoneServices, isZoneBookingEnabled } from "@/lib/zones/server"

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return { title: "Evento no encontrado — MK Cars" }
  const when = [formatEventDate(event.event_date), event.place].filter(Boolean).join(" · ")
  const description = event.description ?? (when ? `${when}. Reservá tu lavado premium.` : "Reservá tu lavado premium.")
  return {
    metadataBase: new URL("https://www.mkcars.com.ar"),
    title: `${event.title} — MK Cars`,
    description,
    alternates: { canonical: `/evento/${event.slug}` },
    openGraph: {
      title: event.title,
      description,
      url: `/evento/${event.slug}`,
      siteName: "MK Cars",
      locale: "es_AR",
      type: "website",
      images: [{ url: "/images/og-reservar.png", width: 1200, height: 630, alt: "MK Cars — Lavado premium" }],
    },
    twitter: { card: "summary_large_image", title: event.title, description, images: ["/images/og-reservar.png"] },
  }
}

export default async function EventoPage({ params }: Props) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()

  const today = todayArgentina()
  const over = isEventOver(event, today)
  const date = formatEventDate(event.event_date)

  const [prices, blockedDates, zoneBookingEnabled] = over
    ? [null, [], false]
    : await Promise.all([getVehiclePrices(), getUpcomingBlockedDates(today), isZoneBookingEnabled()])
  const zoneServices = zoneBookingEnabled ? await getZoneServices() : []

  return (
    <main className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] text-center md:px-8 md:pb-10 md:pt-10">
        <Link href="/" aria-label="Ir a la página principal de MK Cars">
          <Logo className="w-[170px] md:w-[220px]" />
        </Link>

        <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-3xl border border-primary/30 bg-primary/10 px-6 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Evento MK Cars</p>
          <h1 className="text-balance text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-4xl md:text-5xl">
            {event.title}
          </h1>
          {(date || event.place) && (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium">
              {date && (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                  {date}
                </span>
              )}
              {event.place && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  {event.place}
                </span>
              )}
            </div>
          )}
          {event.description && (
            <p className="max-w-md text-pretty text-[0.95rem] leading-relaxed text-muted-foreground">{event.description}</p>
          )}
          {!over && (
            <a
              href="#reservar"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {event.button_label}
            </a>
          )}
        </div>
      </header>

      {over ? (
        <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 pb-10 text-center">
          <p className="text-pretty text-muted-foreground">Este evento ya finalizó, pero podés reservar tu lavado a domicilio cuando quieras.</p>
          <Link
            href="/reservar"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Reservar lavado
          </Link>
        </section>
      ) : (
        <div id="reservar" className="scroll-mt-6">
          <Booking
            prices={prices}
            blockedDates={blockedDates.map((b) => b.day)}
            zoneBookingEnabled={zoneBookingEnabled}
            zoneServices={zoneServices}
            origin={`evento:${event.slug}`}
            standalone
          />
        </div>
      )}

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
