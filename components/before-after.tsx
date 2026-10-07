import Image from "next/image"
import { Sparkles } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"

export function BeforeAfter() {
  return (
    <section id="antes-despues" className="bg-surface py-16 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <SectionHeading
          eyebrow="Antes / Después"
          title="La diferencia se ve."
          description="Del polvo al brillo, en una pasada."
        />

        <Reveal className="mt-10 md:mt-14">
          <div className="relative mx-auto aspect-[1312/816] max-w-4xl select-none overflow-hidden rounded-[2rem] bg-sky shadow-soft">
            <Image
              src="/images/mercedes-before.jpg"
              alt="Mercedes-Benz negro antes del lavado, con polvo y llantas sucias"
              fill
              sizes="(min-width: 1024px) 896px, 100vw"
              className="object-cover"
            />
            <div className="wash-reveal absolute inset-0" aria-hidden="true">
              <Image
                src="/images/mercedes-after.jpg"
                alt=""
                fill
                sizes="(min-width: 1024px) 896px, 100vw"
                className="object-cover"
              />
            </div>

            <div className="wash-line pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_24px_6px_rgba(53,164,255,0.55)]" aria-hidden="true">
              <span className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-soft md:size-11">
                <Sparkles className="size-5" />
              </span>
            </div>

            <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
              Después
            </span>
            <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-deep backdrop-blur">
              Antes
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
