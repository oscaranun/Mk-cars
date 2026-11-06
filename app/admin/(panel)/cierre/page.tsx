import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin/auth"
import { saveCashClosing } from "@/app/admin/(panel)/pro-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, EmptyState, Field, PageHeader, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatDate, isValidDate, money, todayArgentina } from "@/lib/admin/format"
import { PAYMENT_METHOD } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Cierre de caja" }

type Closing = {
  day: string
  expected: Record<string, number>
  counted: Record<string, number>
  difference: number
  notes: string | null
  closed_by_email: string | null
}

export default async function CierrePage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { dia } = await searchParams
  const day = dia && isValidDate(dia) ? dia : todayArgentina()
  const { supabase } = await requireAdmin()
  const from = `${day}T00:00:00-03:00`
  const to = `${day}T23:59:59.999-03:00`

  const [{ data: pays }, { data: exps }, { data: existing }, { data: history }] = await Promise.all([
    supabase.from("payments").select("amount, method").is("voided_at", null).gte("paid_at", from).lte("paid_at", to),
    supabase.from("expenses").select("amount, method").eq("spent_on", day),
    supabase.from("cash_closings").select("*").eq("day", day).maybeSingle(),
    supabase.from("cash_closings").select("day, difference, closed_by_email").order("day", { ascending: false }).limit(15),
  ])

  const methods = Object.keys(PAYMENT_METHOD)
  const income: Record<string, number> = Object.fromEntries(methods.map((m) => [m, 0]))
  const outflow: Record<string, number> = Object.fromEntries(methods.map((m) => [m, 0]))
  for (const p of pays ?? []) income[p.method ?? "otro"] = (income[p.method ?? "otro"] ?? 0) + Number(p.amount)
  for (const e of exps ?? []) outflow[e.method ?? "otro"] = (outflow[e.method ?? "otro"] ?? 0) + Number(e.amount)
  const closing = existing as Closing | null

  return (
    <>
      <PageHeader
        title="Cierre de caja"
        description="Compará lo que el sistema registró con lo que contaste, medio por medio."
        actions={
          <form method="get" className="flex items-end gap-2">
            <Field label="Día" htmlFor="dia">
              <input id="dia" name="dia" type="date" defaultValue={day} className={fieldClass} />
            </Field>
            <button type="submit" className={secondaryButtonClass}>
              Ver
            </button>
          </form>
        }
      />
      <Card className="flex flex-col gap-4">
        <SectionTitle aside={closing && <Badge tone={Number(closing.difference) === 0 ? "success" : "warning"}>Cerrado</Badge>}>
          {formatDate(day)}
        </SectionTitle>
        <ActionForm action={saveCashClosing} submitLabel={closing ? "Actualizar cierre" : "Guardar cierre"}>
          <input type="hidden" name="day" value={day} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2">Medio</th>
                  <th scope="col" className="py-2 text-right">Entró</th>
                  <th scope="col" className="py-2 text-right">Salió</th>
                  <th scope="col" className="py-2 text-right">Esperado</th>
                  <th scope="col" className="py-2 pl-4">Contado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {methods.map((m) => {
                  const expected = income[m] - outflow[m]
                  return (
                    <tr key={m}>
                      <th scope="row" className="py-2 text-left font-medium">{PAYMENT_METHOD[m]}</th>
                      <td className="py-2 text-right tabular-nums">{money(income[m])}</td>
                      <td className="py-2 text-right tabular-nums">{money(outflow[m])}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{money(expected)}</td>
                      <td className="py-2 pl-4">
                        <label className="sr-only" htmlFor={`counted_${m}`}>Contado en {PAYMENT_METHOD[m]}</label>
                        <input
                          id={`counted_${m}`}
                          name={`counted_${m}`}
                          inputMode="decimal"
                          defaultValue={closing ? String(closing.counted[m] ?? 0) : String(expected)}
                          className={`${fieldClass} w-32`}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Field label="Notas" htmlFor="notes">
            <textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={closing?.notes ?? ""} className={fieldClass} />
          </Field>
        </ActionForm>
        {closing && (
          <p className="text-sm">
            Diferencia registrada: <strong className="tabular-nums">{money(closing.difference)}</strong>
            {closing.closed_by_email && <span className="text-muted-foreground"> · por {closing.closed_by_email}</span>}
          </p>
        )}
      </Card>
      <section className="flex flex-col gap-3">
        <SectionTitle>Cierres anteriores</SectionTitle>
        {(history ?? []).length === 0 ? (
          <EmptyState>Todavía no hay cierres guardados.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {(history ?? []).map((h) => (
              <li key={h.day} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                <a href={`/admin/cierre?dia=${h.day}`} className="font-medium hover:text-electric">{formatDate(h.day)}</a>
                <Badge tone={Number(h.difference) === 0 ? "success" : "warning"}>
                  {Number(h.difference) === 0 ? "Sin diferencias" : `Diferencia ${money(h.difference)}`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
