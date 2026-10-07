import { Clock, Droplets, Home, ShieldCheck, Sparkles, Wallet } from "lucide-react"
import { SectionHeading } from "./section-heading"

const BENEFITS = [
  { icon: Home, title: "Sin moverte", body: "Lavamos en tu casa, oficina o donde esté estacionado tu auto." },
  { icon: Clock, title: "Ahorrás tiempo", body: "Nada de filas ni esperas. Seguís con tu día mientras trabajamos." },
  { icon: Droplets, title: "Agua flexible", body: "Con nuestro propio tanque o con el agua de tu casa." },
  { icon: Sparkles, title: "Terminación premium", body: "Productos de calidad y secado a mano con microfibra." },
  { icon: ShieldCheck, title: "Cuidado del detalle", body: "Técnicas seguras que protegen la pintura de rayones." },
  { icon: Wallet, title: "Precio claro", body: "Sabés cuánto pagás desde el primer mensaje. Sin sorpresas." },
]

export function Benefits() {
  return (
    <section aria-labelledby="beneficios-title" id="beneficios" className="border-t border-border bg-background py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading id="beneficios-title" eyebrow="04 — Beneficios" title="Por qué elegir MK Cars." />
        <ul className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-5 bg-white p-6 md:flex-col md:p-8">
              <Icon className="size-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-pretty leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
