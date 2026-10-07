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
    <footer className="border-t border-border pb-28 pt-16 md:pb-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 md:flex-row md:items-end md:justify-between md:px-8">
        <div className="flex flex-col gap-4">
          <Logo className="[&>span:first-child]:text-3xl" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
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
              className="flex min-h-11 items-center gap-3 text-sm transition-colors hover:text-silver"
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
              className="flex min-h-11 items-center gap-3 text-sm transition-colors hover:text-silver"
            >
              <InstagramIcon className="size-4" />@{INSTAGRAM_HANDLE}
            </a>
          </li>
        </ul>
      </div>
      <p className="mx-auto mt-12 max-w-6xl px-5 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground md:px-8">
        © {new Date().getFullYear()} MK Cars · Mendoza, Argentina
      </p>
    </footer>
  )
}
