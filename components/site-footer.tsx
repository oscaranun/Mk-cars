import { InstagramIcon } from "@/components/instagram-icon"
import { Logo } from "@/components/logo"
import { WhatsAppIcon } from "@/components/whatsapp-icon"
import {
  DEFAULT_WHATSAPP_MESSAGE,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  SERVICE_DAYS,
  SERVICE_HOURS,
  WHATSAPP_DISPLAY,
  whatsappUrl,
} from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="bg-deep pb-32 pt-14 text-white md:pb-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 md:flex-row md:items-end md:justify-between md:px-8">
        <div className="flex flex-col gap-4">
          <Logo inverted />
          <p className="max-w-xs text-sm leading-relaxed text-white/60">
            Lavado premium a domicilio en Gran Mendoza. {SERVICE_DAYS.full}, {SERVICE_HOURS.open} a{" "}
            {SERVICE_HOURS.close}.
          </p>
        </div>
        <ul className="flex flex-col gap-1">
          <li>
            <a
              href={whatsappUrl(DEFAULT_WHATSAPP_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-3 text-sm text-white/85 transition-colors hover:text-white"
            >
              <WhatsAppIcon className="size-4" />
              {WHATSAPP_DISPLAY}
            </a>
          </li>
          <li>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-3 text-sm text-white/85 transition-colors hover:text-white"
            >
              <InstagramIcon className="size-4" />@{INSTAGRAM_HANDLE}
            </a>
          </li>
        </ul>
      </div>
      <p className="mx-auto mt-10 max-w-6xl px-5 text-xs text-white/40 md:px-8">
        © {new Date().getFullYear()} MK Cars · Mendoza, Argentina
      </p>
    </footer>
  )
}
