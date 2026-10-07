import { WhatsAppIcon } from "@/components/whatsapp-icon"
import { DEFAULT_WHATSAPP_MESSAGE, whatsappUrl } from "@/lib/site"

export function WhatsAppFloat() {
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3">
          <a
            href="#reservar"
            className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-primary text-base font-medium text-primary-foreground shadow-glow active:scale-[0.98]"
          >
            Reservar lavado
          </a>
          <a
            href={whatsappUrl(DEFAULT_WHATSAPP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Escribir por WhatsApp"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-whatsapp text-white active:scale-95"
          >
            <WhatsAppIcon className="size-6" />
          </a>
        </div>
      </div>

      <a
        href={whatsappUrl(DEFAULT_WHATSAPP_MESSAGE)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribir por WhatsApp"
        className="fixed bottom-6 right-6 z-50 hidden size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-[0_12px_32px_-10px_rgba(37,211,102,0.6)] transition-transform hover:scale-105 active:scale-95 md:flex"
      >
        <WhatsAppIcon className="size-7" />
      </a>
    </>
  )
}
