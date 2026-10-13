import { BeforeAfter } from "@/components/before-after"
import { Benefits } from "@/components/benefits"
import { Booking } from "@/components/booking"
import { Hero } from "@/components/hero"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { WhatsAppFloat } from "@/components/whatsapp-float"
import { getVehiclePrices } from "@/lib/prices"

export const revalidate = 60

export default async function Page() {
  const prices = await getVehiclePrices()
  return (
    <>
      <SiteHeader />
      <main>
        <Hero fromPrice={prices ? Math.min(prices.auto, prices.suv, prices.pickup) : null} />
        <Benefits />
        <BeforeAfter />
        <Booking prices={prices} />
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </>
  )
}
