import type { Metadata } from "next"
import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { EmptyState, PageHeader, TableWrap, TextLink, secondaryButtonClass, tdClass, thClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDate, formatWhatsapp, money, whatsappLink } from "@/lib/admin/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Recontactar" }

const OPTIONS = [30, 45, 60, 90]

type Row = {
  id: string
  full_name: string
  whatsapp: string
  marketing_consent: boolean | null
  services: { performed_at: string; amount_paid: number | null }[]
  appointments: { status: string; requested_start: string | null; confirmed_start: string | null }[]
}

const UPCOMING = ["solicitado", "reprogramado", "esperando_cliente", "confirmado"]

function message(name: string) {
  const first = name.split(" ")[0]
  return `Hola ${first}! Te escribimos de MK Cars. Hace un tiempo que no lavamos tu auto, ¿querés que te reservemos un turno esta semana? Vamos a tu casa o trabajo.`
}

export default async function RecontactPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const days = OPTIONS.includes(Number(params.dias)) ? Number(params.dias) : 30
  const cutoff = Date.now() - days * 86_400_000

  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, whatsapp, marketing_consent, services(performed_at, amount_paid), appointments(status, requested_start, confirmed_start)")
    .is("archived_at", null)
    .limit(2000)
    .returns<Row[]>()
  if (error) console.error("[admin] recontact query failed:", error.code, error.message)

  const rows = (data ?? [])
    .filter((c) => c.services.length > 0 && !c.appointments.some((a) => UPCOMING.includes(a.status)))
    .map((c) => {
      const last = c.services.reduce((max, s) => (s.performed_at > max ? s.performed_at : max), c.services[0].performed_at)
      const total = c.services.reduce((sum, s) => sum + Number(s.amount_paid ?? 0), 0)
      return { ...c, last, total, visits: c.services.length }
    })
    .filter((c) => new Date(c.last).getTime() < cutoff)
    .sort((a, b) => b.total - a.total)

  return (
    <>
      <PageHeader
        title="Recontactar"
        description={`${rows.length} cliente${rows.length === 1 ? "" : "s"} sin lavar hace más de ${days} días y sin turnos pendientes. Ordenados por lo que gastaron.`}
      />

      <nav aria-label="Antigüedad" className="flex flex-wrap gap-2">
        {OPTIONS.map((d) => (
          <Link
            key={d}
            href={`/admin/recontactar?dias=${d}`}
            aria-current={d === days ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              d === days ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            +{d} días
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Último lavado</th>
              <th className={thClass}>Lavados</th>
              <th className={thClass}>Total gastado</th>
              <th className={thClass}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className={tdClass}>
                  <div className="flex flex-col gap-0.5">
                    <TextLink href={`/admin/clientes/${c.id}`}>{c.full_name}</TextLink>
                    <span className="text-xs tabular-nums text-muted-foreground">{formatWhatsapp(c.whatsapp)}</span>
                    {c.marketing_consent === false && <span className="text-xs text-amber-200">No aceptó recibir promociones</span>}
                  </div>
                </td>
                <td className={cn(tdClass, "tabular-nums")}>
                  {formatDate(c.last)}
                  <span className="block text-xs text-muted-foreground">hace {Math.floor((Date.now() - new Date(c.last).getTime()) / 86_400_000)} días</span>
                </td>
                <td className={cn(tdClass, "tabular-nums")}>{c.visits}</td>
                <td className={cn(tdClass, "tabular-nums")}>{money(c.total)}</td>
                <td className={cn(tdClass, "text-right")}>
                  <a
                    href={`${whatsappLink(c.whatsapp)}?text=${encodeURIComponent(message(c.full_name))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(secondaryButtonClass, "min-h-9 px-4")}
                  >
                    <MessageCircle className="size-4 text-emerald-300" aria-hidden="true" />
                    Escribir
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState>No hay clientes para recontactar en este rango.</EmptyState>
      )}
    </>
  )
}
