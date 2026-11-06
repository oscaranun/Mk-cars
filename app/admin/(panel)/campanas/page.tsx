import type { Metadata } from "next"
import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { requireAdmin } from "@/lib/admin/auth"
import { createCoupon, updateCoupon } from "@/app/admin/(panel)/pro-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, EmptyState, Field, PageHeader, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatDate, money, todayArgentina, whatsappLink } from "@/lib/admin/format"

export const metadata: Metadata = { title: "Campañas y cupones" }

type Coupon = { id: string; code: string; kind: string; value: number; max_uses: number | null; uses: number; active: boolean; expires_on: string | null }

const DEFAULT_MESSAGE = "Hola {nombre}! Hace un tiempo que no lavamos tu auto. Esta semana tenemos un descuento para vos{cupon}. ¿Te reservo un turno?"

export default async function CampanasPage({ searchParams }: { searchParams: Promise<{ dias?: string; cupon?: string; mensaje?: string }> }) {
  const params = await searchParams
  const days = [30, 45, 60, 90, 180].includes(Number(params.dias)) ? Number(params.dias) : 45
  const { supabase } = await requireAdmin()
  const today = todayArgentina()

  const [{ data: clients }, { data: services }, { data: coupons }] = await Promise.all([
    supabase.from("clients").select("id, full_name, whatsapp").eq("marketing_consent", true).is("archived_at", null).eq("is_demo", false).limit(2000),
    supabase.from("services").select("client_id, performed_at").order("performed_at", { ascending: false }).limit(5000),
    supabase.from("coupons").select("id, code, kind, value, max_uses, uses, active, expires_on").order("created_at", { ascending: false }),
  ])

  const lastWash = new Map<string, string>()
  for (const s of services ?? []) if (s.client_id && !lastWash.has(s.client_id)) lastWash.set(s.client_id, s.performed_at)
  const cutoff = Date.now() - days * 86_400_000
  const segment = (clients ?? [])
    .filter((c) => c.whatsapp && lastWash.has(c.id) && new Date(lastWash.get(c.id)!).getTime() < cutoff)
    .sort((a, b) => lastWash.get(a.id)!.localeCompare(lastWash.get(b.id)!))

  const couponList = (coupons ?? []) as Coupon[]
  const usable = couponList.filter((c) => c.active && (!c.expires_on || c.expires_on >= today))
  const couponCode = usable.find((c) => c.code === params.cupon)?.code ?? ""
  const template = (params.mensaje ?? DEFAULT_MESSAGE).slice(0, 600)
  const build = (name: string | null) =>
    template.replaceAll("{nombre}", (name ?? "").split(" ")[0] || "").replaceAll("{cupon}", couponCode ? ` con el código ${couponCode}` : "")

  return (
    <>
      <PageHeader title="Campañas y cupones" description="Armá un mensaje para un grupo de clientes y envialo uno por uno por WhatsApp." />

      <Card className="flex flex-col gap-4">
        <SectionTitle>Clientes para recontactar</SectionTitle>
        <form method="get" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Sin lavar hace más de" htmlFor="dias">
              <select id="dias" name="dias" defaultValue={String(days)} className={fieldClass}>
                {[30, 45, 60, 90, 180].map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cupón (opcional)" htmlFor="cupon">
              <select id="cupon" name="cupon" defaultValue={couponCode} className={fieldClass}>
                <option value="">Sin cupón</option>
                {usable.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Mensaje. Usá {nombre} y {cupon} para completarlos solos." htmlFor="mensaje">
            <textarea id="mensaje" name="mensaje" rows={3} maxLength={600} defaultValue={template} className={fieldClass} />
          </Field>
          <button type="submit" className={`${secondaryButtonClass} self-start`}>
            Actualizar lista
          </button>
        </form>
        <p className="text-sm text-muted-foreground">
          {segment.length} clientes aceptaron promociones y no lavan hace más de {days} días.
        </p>
        {segment.length === 0 ? (
          <EmptyState>No hay clientes en este grupo.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {segment.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/admin/clientes/${c.id}`} className="font-medium hover:text-electric">
                    {c.full_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">Último lavado: {formatDate(lastWash.get(c.id)!)}</p>
                </div>
                <a href={`${whatsappLink(c.whatsapp!)}?text=${encodeURIComponent(build(c.full_name))}`} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                  <MessageCircle className="size-4 text-emerald-400" aria-hidden="true" />
                  Enviar
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle>Cupones de descuento</SectionTitle>
        <ActionForm action={createCoupon} submitLabel="Crear cupón" inline resetOnSuccess>
          <Field label="Código" htmlFor="code">
            <input id="code" name="code" required maxLength={30} placeholder="VERANO10" className={`${fieldClass} uppercase`} />
          </Field>
          <Field label="Tipo" htmlFor="kind">
            <select id="kind" name="kind" className={fieldClass}>
              <option value="porcentaje">Porcentaje</option>
              <option value="monto">Monto fijo</option>
            </select>
          </Field>
          <Field label="Valor" htmlFor="value">
            <input id="value" name="value" inputMode="decimal" required className={`${fieldClass} w-28`} />
          </Field>
          <Field label="Usos máximos" htmlFor="max_uses">
            <input id="max_uses" name="max_uses" type="number" min={1} placeholder="Sin límite" className={`${fieldClass} w-32`} />
          </Field>
          <Field label="Vence" htmlFor="expires_on">
            <input id="expires_on" name="expires_on" type="date" className={fieldClass} />
          </Field>
        </ActionForm>
        {couponList.length === 0 ? (
          <EmptyState>Todavía no creaste cupones.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {couponList.map((c) => {
              const expired = !!c.expires_on && c.expires_on < today
              const exhausted = !!c.max_uses && c.uses >= c.max_uses
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/60 p-3">
                  <span className="font-mono font-semibold">{c.code}</span>
                  <span className="text-sm">{c.kind === "porcentaje" ? `${c.value}% off` : `${money(c.value)} off`}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.uses}
                    {c.max_uses ? ` / ${c.max_uses}` : ""} usos{c.expires_on ? ` · vence ${formatDate(c.expires_on)}` : ""}
                  </span>
                  <span className="flex-1" />
                  {!c.active ? <Badge>Desactivado</Badge> : expired ? <Badge tone="danger">Vencido</Badge> : exhausted ? <Badge tone="warning">Agotado</Badge> : <Badge tone="success">Activo</Badge>}
                  <ActionForm action={updateCoupon} submitLabel="Registrar uso" submitClassName={secondaryButtonClass}>
                    <input type="hidden" name="coupon_id" value={c.id} />
                    <input type="hidden" name="op" value="usar" />
                  </ActionForm>
                  <ActionForm action={updateCoupon} submitLabel={c.active ? "Desactivar" : "Activar"} submitClassName={secondaryButtonClass}>
                    <input type="hidden" name="coupon_id" value={c.id} />
                    <input type="hidden" name="op" value="toggle" />
                  </ActionForm>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
