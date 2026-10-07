import { Benefits } from "@/components/benefits"
import { Booking } from "@/components/booking"
import { Coverage } from "@/components/coverage"
import { Hero } from "@/components/hero"
import { HowItWorks } from "@/components/how-it-works"
import { MobileCta } from "@/components/mobile-cta"
import { Services } from "@/components/services"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Services />
        <HowItWorks />
        <Coverage />
        <Benefits />
        <Booking />
      </main>
      <SiteFooter />
      <MobileCta />
    </>
  )
}
