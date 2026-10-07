import { DEFAULT_WHATSAPP_MESSAGE, whatsappUrl } from "@/lib/site"
import { WhatsAppIcon } from "./whatsapp-icon"

export function MobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <a
        href={whatsappUrl(DEFAULT_WHATSAPP_MESSAGE)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-accent text-base font-semibold text-inverse shadow-lg shadow-black/25"
      >
        <WhatsAppIcon className="size-5" />
        Reservar por WhatsApp
      </a>
    </div>
  )
}
