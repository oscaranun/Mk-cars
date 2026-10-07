import { DEFAULT_WHATSAPP_MESSAGE, whatsappUrl } from "@/lib/site"
import { WhatsAppIcon } from "./whatsapp-icon"

const NAV = [
  { href: "#servicios", label: "Servicios" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#cobertura", label: "Cobertura" },
  { href: "#reservar", label: "Reservar" },
]

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-inverse/80 text-inverse-foreground backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#inicio" className="flex min-h-11 items-center gap-2" aria-label="MK Cars, inicio">
          <span className="text-lg font-semibold tracking-tight">MK</span>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-inverse-muted">Cars</span>
        </a>
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm text-inverse-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-inverse-foreground">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href={whatsappUrl(DEFAULT_WHATSAPP_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-2 rounded-full bg-inverse-foreground px-4 text-sm font-medium text-inverse transition-opacity hover:opacity-90"
        >
          <WhatsAppIcon className="size-4" />
          Reservar
        </a>
      </div>
    </header>
  )
}
