import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { OfferResponseForm, type PublicOffer } from "@/components/offer-response"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Tu propuesta de turno · MK Cars",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f]{48}$/.test(token)) notFound()
  const supabase = await createClient()
  if (!supabase) notFound()
  const { data, error } = await supabase.rpc("get_appointment_offer", { p_token: token })
  if (error) console.error("[offer] load error:", error.code, error.message)
  if (!data) notFound()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-3">
        <Image src="/images/mk-logo.png" alt="MK Cars" width={120} height={60} className="h-10 w-auto" priority />
      </header>
      <OfferResponseForm token={token} offer={data as PublicOffer} />
    </main>
  )
}
