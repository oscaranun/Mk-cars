import type { Metadata } from "next"
import { BeforeAfter } from "@/components/before-after"
import { Benefits } from "@/components/benefits"
import { Booking } from "@/components/booking"
import { BusinessJsonLd } from "@/components/business-json-ld"
import { Hero } from "@/components/hero"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { WhatsAppFloat } from "@/components/whatsapp-float"
import { todayArgentina } from "@/lib/admin/format"
import { getUpcomingBlockedDates } from "@/lib/blocked-dates"
import { getVehiclePrices } from "@/lib/prices"

export const revalidate = 60

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default async function Page() {
  const [prices, blockedDates] = await Promise.all([getVehiclePrices(), getUpcomingBlockedDates(todayArgentina())])
  return (
    <>
      <BusinessJsonLd />
      <SiteHeader />
      <main>
        <Hero fromPrice={prices ? Math.min(prices.auto, prices.suv, prices.pickup) : null} />
        <Benefits />
        <BeforeAfter />
        <Booking prices={prices} blockedDates={blockedDates.map((b) => b.day)} />
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </>
  )
}
