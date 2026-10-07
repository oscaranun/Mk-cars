import { WhatsAppIcon } from "@/components/whatsapp-icon"
import { DEFAULT_WHATSAPP_MESSAGE, whatsappUrl } from "@/lib/site"

export function WhatsAppFloat() {
  return (
    <a
      href={whatsappUrl(DEFAULT_WHATSAPP_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Reservar por WhatsApp"
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-50 flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-[0_10px_40px_-8px_rgba(37,211,102,0.55)] transition-transform hover:scale-105 active:scale-95"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  )
}
