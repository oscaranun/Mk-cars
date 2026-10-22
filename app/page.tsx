import { BeforeAfter } from "@/components/before-after"
import { Benefits } from "@/components/benefits"
import { Booking } from "@/components/booking"
import { Hero } from "@/components/hero"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { WhatsAppFloat } from "@/components/whatsapp-float"
import { todayArgentina } from "@/lib/admin/format"
import { getUpcomingBlockedDates } from "@/lib/blocked-dates"
import { getVehiclePrices } from "@/lib/prices"
import { getZoneServices, isZoneBookingEnabled } from "@/lib/zones/server"

export const revalidate = 60

export default async function Page() {
  const [prices, blockedDates, zoneBookingEnabled] = await Promise.all([getVehiclePrices(), getUpcomingBlockedDates(todayArgentina()), isZoneBookingEnabled()])
  const zoneServices = zoneBookingEnabled ? await getZoneServices() : []
  return (
    <>
      <SiteHeader />
      <main>
        <Hero fromPrice={prices ? Math.min(prices.auto, prices.suv, prices.pickup) : null} />
        <Benefits />
        <BeforeAfter />
        <Booking prices={prices} blockedDates={blockedDates.map((b) => b.day)} zoneBookingEnabled={zoneBookingEnabled} zoneServices={zoneServices} />
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </>
  )
}
