"use client"

import { useEffect, useState } from "react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#servicios", label: "Precios" },
  { href: "#cobertura", label: "Cobertura" },
]

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-colors duration-500",
        scrolled ? "border-b border-border/60 bg-background/75 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <a href="#inicio" aria-label="MK Cars, ir al inicio" className="flex min-h-11 items-center">
          <Logo />
        </a>
        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href="#reservar"
          className="inline-flex min-h-11 items-center rounded-full border border-foreground/25 px-5 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
        >
          Reservar
        </a>
      </div>
    </header>
  )
}
