import { BeforeAfter } from "@/components/before-after"
import { Benefits } from "@/components/benefits"
import { Booking } from "@/components/booking"
import { Coverage } from "@/components/coverage"
import { Hero } from "@/components/hero"
import { HowItWorks } from "@/components/how-it-works"
import { Services } from "@/components/services"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { WhatsAppFloat } from "@/components/whatsapp-float"

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Services />
        <Coverage />
        <Benefits />
        <BeforeAfter />
        <Booking />
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </>
  )
}
