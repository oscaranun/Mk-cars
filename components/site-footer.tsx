import { DEFAULT_WHATSAPP_MESSAGE, SERVICE_DAYS, SERVICE_HOURS, WHATSAPP_DISPLAY, whatsappUrl } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="border-t border-inverse-border bg-inverse pb-28 pt-12 text-inverse-foreground md:pb-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-6xl font-semibold tracking-tighter md:text-8xl">MK Cars</p>
          <p className="mt-3 text-inverse-muted">Lavado de autos a domicilio · Gran Mendoza, Argentina</p>
        </div>
        <dl className="grid grid-cols-2 gap-6 text-sm md:text-right">
          <div>
            <dt className="font-mono text-xs uppercase tracking-[0.2em] text-inverse-muted">Horario</dt>
            <dd className="mt-1">
              {SERVICE_DAYS.full}
              <br />
              {SERVICE_HOURS.open} a {SERVICE_HOURS.close} hs
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-[0.2em] text-inverse-muted">Contacto</dt>
            <dd className="mt-1">
              <a
                href={whatsappUrl(DEFAULT_WHATSAPP_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:no-underline"
              >
                <span className="sr-only">WhatsApp </span>
                {WHATSAPP_DISPLAY}
              </a>
            </dd>
          </div>
        </dl>
      </div>
      <p className="mx-auto mt-10 max-w-6xl px-5 font-mono text-xs text-inverse-muted">
        © {new Date().getFullYear()} MK Cars. Todos los derechos reservados.
      </p>
    </footer>
  )
}
