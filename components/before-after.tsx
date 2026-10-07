"use client"

import Image from "next/image"
import { useState } from "react"
import { ChevronsLeftRight } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SectionHeading } from "@/components/section-heading"

export function BeforeAfter() {
  const [position, setPosition] = useState(50)

  return (
    <section id="antes-despues" className="bg-surface py-16 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <SectionHeading eyebrow="Antes / Después" title="La diferencia se ve." description="Deslizá para comparar." />

        <Reveal className="mt-10 md:mt-14">
          <div className="relative mx-auto aspect-square max-w-2xl select-none overflow-hidden rounded-[2rem] bg-sky shadow-soft">
            <Image
              src="/images/after.png"
              alt="Auto después del lavado, con la pintura brillante"
              fill
              sizes="(min-width: 768px) 672px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
              <Image
                src="/images/before.png"
                alt="Auto antes del lavado, con polvo y barro"
                fill
                sizes="(min-width: 768px) 672px, 100vw"
                className="object-cover"
              />
            </div>

            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-deep backdrop-blur">
              Antes
            </span>
            <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
              Después
            </span>

            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            >
              <span className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary shadow-soft">
                <ChevronsLeftRight className="size-5" />
              </span>
            </div>

            <label htmlFor="before-after-range" className="sr-only">
              Comparar antes y después
            </label>
            <input
              id="before-after-range"
              type="range"
              min={0}
              max={100}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
