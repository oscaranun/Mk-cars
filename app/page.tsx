import { BeforeAfter } from "@/components/before-after"
import { Benefits } from "@/components/benefits"
import { Booking } from "@/components/booking"
import { Hero } from "@/components/hero"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { WhatsAppFloat } from "@/components/whatsapp-float"

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Benefits />
        <BeforeAfter />
        <Booking />
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </>
  )
}
