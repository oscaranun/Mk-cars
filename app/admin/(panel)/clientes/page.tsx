import type { Metadata } from "next"
import {
  EmptyState,
  ExportLink,
  Field,
  FilterBar,
  PageHeader,
  TableWrap,
  TextLink,
  fieldClass,
  tdClass,
  thClass,
} from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDate, formatWhatsapp, money, sanitizeSearch } from "@/lib/admin/format"
import { VEHICLE_CATEGORY } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Clientes" }

type ClientRow = {
  id: string
  full_name: string
  whatsapp: string
  email: string | null
  source: string
  created_at: string
  vehicles: { category: string; brand: string | null; model: string | null }[]
  inquiries: { created_at: string }[]
  services: { amount_paid: number }[]
}

type SearchParams = Promise<{ q?: string; origen?: string; lavados?: string; orden?: string }>

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const q = sanitizeSearch(params.q)

  let query = supabase
    .from("clients")
    .select(
      "id, full_name, whatsapp, email, source, created_at, vehicles(category, brand, model), inquiries(created_at), services(amount_paid)",
    )
    .order("created_at", { ascending: false })
    .limit(1000)
  if (q) {
    const digits = q.replace(/\D/g, "")
    const terms = [`full_name.ilike.*${q}*`, `email.ilike.*${q}*`]
    if (digits.length >= 3) terms.push(`whatsapp.ilike.*${digits}*`)
    query = query.or(terms.join(","))
  }
  if (params.origen) query = query.eq("source", params.origen.slice(0, 40))

  const [{ data, error }, sources] = await Promise.all([
    query.returns<ClientRow[]>(),
    supabase.from("clients").select("source").limit(2000),
  ])
  if (error) console.error("[admin] clients query failed:", error.code)

  const sourceOptions = Array.from(new Set((sources.data ?? []).map((s) => s.source))).sort()

  let rows = (data ?? []).map((c) => ({
    ...c,
    firstInquiry: c.inquiries.reduce<string | null>((min, i) => (!min || i.created_at < min ? i.created_at : min), null),
    washes: c.services.length,
    paid: c.services.reduce((sum, s) => sum + Number(s.amount_paid), 0),
  }))
  if (params.lavados === "sin") rows = rows.filter((r) => r.washes === 0)
  if (params.lavados === "con") rows = rows.filter((r) => r.washes >= 1)
  if (params.lavados === "recurrentes") rows = rows.filter((r) => r.washes >= 2)
  if (params.orden === "pagado") rows.sort((a, b) => b.paid - a.paid)
  if (params.orden === "lavados") rows.sort((a, b) => b.washes - a.washes)
  if (params.orden === "nombre") rows.sort((a, b) => a.full_name.localeCompare(b.full_name, "es"))

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${rows.length} cliente${rows.length === 1 ? "" : "s"}`}
        actions={<ExportLink entity="clientes" />}
      />

      <FilterBar resetHref="/admin/clientes">
        <Field label="Buscar" htmlFor="q" className="md:w-64">
          <input id="q" name="q" type="search" defaultValue={params.q} placeholder="Nombre, WhatsApp o correo" className={fieldClass} />
        </Field>
        <Field label="Origen" htmlFor="origen" className="md:w-40">
          <select id="origen" name="origen" defaultValue={params.origen ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            {sourceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lavados" htmlFor="lavados" className="md:w-44">
          <select id="lavados" name="lavados" defaultValue={params.lavados ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            <option value="sin">Sin lavados</option>
            <option value="con">Con al menos 1</option>
            <option value="recurrentes">Recurrentes (2 o más)</option>
          </select>
        </Field>
        <Field label="Ordenar por" htmlFor="orden" className="md:w-44">
          <select id="orden" name="orden" defaultValue={params.orden ?? ""} className={fieldClass}>
            <option value="">Más recientes</option>
            <option value="nombre">Nombre</option>
            <option value="lavados">Más lavados</option>
            <option value="pagado">Más pagado</option>
          </select>
        </Field>
      </FilterBar>

      {rows.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th className={thClass}>Cliente</th>
              <th className={thClass}>Contacto</th>
              <th className={thClass}>Primera consulta</th>
              <th className={thClass}>Vehículos</th>
              <th className={`${thClass} text-right`}>Lavados</th>
              <th className={`${thClass} text-right`}>Total pagado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="transition hover:bg-sky/40">
                <td className={tdClass}>
                  <TextLink href={`/admin/clientes/${c.id}`}>{c.full_name}</TextLink>
                  <p className="text-xs text-muted-foreground">Origen: {c.source}</p>
                </td>
                <td className={tdClass}>
                  <p className="tabular-nums">{formatWhatsapp(c.whatsapp)}</p>
                  <p className="text-xs text-muted-foreground">{c.email ?? "Sin correo"}</p>
                </td>
                <td className={`${tdClass} tabular-nums`}>{formatDate(c.firstInquiry ?? c.created_at)}</td>
                <td className={tdClass}>
                  {c.vehicles.length
                    ? c.vehicles
                        .map((v) => [VEHICLE_CATEGORY[v.category] ?? v.category, v.brand, v.model].filter(Boolean).join(" "))
                        .join(" · ")
                    : "—"}
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>{c.washes}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{money(c.paid)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState>No hay clientes que coincidan con los filtros.</EmptyState>
      )}
    </>
  )
}
