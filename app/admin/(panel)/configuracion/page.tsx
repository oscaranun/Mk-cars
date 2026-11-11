import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, FlaskConical, ShieldCheck, type LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { allowedKeys } from "@/lib/admin/permissions"

export const metadata: Metadata = { title: "Configuración" }

const OPTIONS: { key: string; href: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    key: "usuarios",
    href: "/admin/usuarios",
    title: "Usuarios y permisos",
    description: "Accesos al panel y qué secciones ve cada persona.",
    icon: ShieldCheck,
  },
  {
    key: "turnos",
    href: "/admin/turnos#disponibilidad",
    title: "Disponibilidad, precios y datos de cobro",
    description: "Duraciones, capacidad, importes por vehículo y datos de transferencia.",
    icon: ShieldCheck,
  },
  {
    key: "precios",
    href: "/admin/precios",
    title: "Servicios y fidelidad",
    description: "Referencia de precios por servicio y tarjeta de fidelidad.",
    icon: ShieldCheck,
  },
  {
    key: "actividad",
    href: "/admin/actividad",
    title: "Historial de cambios",
    description: "Consultá quién cargó o corrigió cada registro.",
    icon: ShieldCheck,
  },
  {
    key: "pruebas",
    href: "/admin/pruebas",
    title: "Datos de prueba",
    description: "Cargar o borrar datos ficticios para practicar.",
    icon: FlaskConical,
  },
]

export default async function SettingsPage() {
  const { profile } = await requireAdmin()
  const allowed = allowedKeys(profile)
  const options = OPTIONS.filter((o) => allowed.includes(o.key))

  return (
    <>
      <PageHeader title="Configuración" description="Ajustes generales del panel." />
      {options.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {options.map(({ key, href, title, description, icon: Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex min-h-20 items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft transition hover:border-electric/60"
              >
                <Icon className="size-5 shrink-0 text-electric" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm text-muted-foreground text-pretty">{description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No tenés acceso a ninguna opción de configuración.
        </p>
      )}
    </>
  )
}
