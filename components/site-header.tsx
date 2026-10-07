"use client"

import { useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#servicios", label: "Precios" },
  { href: "#cobertura", label: "Cobertura" },
  { href: "#antes-despues", label: "Resultados" },
]

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-all duration-300",
        scrolled ? "border-b border-border bg-deep/85 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-[1cm] md:px-8">
        <a href="#inicio" aria-label="MK Car Wash, ir al inicio" className="flex min-h-11 items-center">
          <Logo />
        </a>
        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm transition-colors",
                scrolled ? "text-muted-foreground hover:text-white" : "text-white/70 hover:text-white",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href="#reservar"
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform active:scale-95"
        >
          Reservar
        </a>
      </div>
    </header>
  )
}
