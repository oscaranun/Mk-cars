import { Logo } from "@/components/logo"

const NAV = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#servicios", label: "Precios" },
  { href: "#cobertura", label: "Cobertura" },
  { href: "#antes-despues", label: "Resultados" },
]

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-[0.65cm] md:px-8">
        <a href="#inicio" aria-label="MK Car Wash, ir al inicio" className="flex min-h-11 items-center">
          <Logo />
        </a>
        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-base text-white/70 transition-colors hover:text-white lg:text-[21px]"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href="#reservar"
          className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-[21px] font-medium text-primary-foreground transition-transform active:scale-95"
        >
          Reservar
        </a>
      </div>
    </header>
  )
}
