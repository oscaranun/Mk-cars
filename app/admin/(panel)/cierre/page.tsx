import { ClosingMethodRow } from "@/components/admin/closing-method-row"
import { QueryErrorNotice } from "@/components/admin/query-error-notice"
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
  opening: Record<string, number>
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

  const [{ data: pays, error: payError }, { data: exps, error: expError }, { data: existing, error: closingError }, { data: history, error: historyError }] = await Promise.all([
    supabase.from("payments").select("amount, method").is("voided_at", null).gte("paid_at", from).lte("paid_at", to),
    supabase.from("expenses").select("amount, method").is("voided_at", null).eq("spent_on", day),
    supabase.from("cash_closings").select("*").eq("day", day).maybeSingle(),
    supabase.from("cash_closings").select("day, difference, closed_by_email, expected, counted").order("day", { ascending: false }).limit(15),
  ])

  if (payError || expError || closingError || historyError) return <QueryErrorNotice subject="los movimientos y cierres de caja" />

  const { data: revisions, error: revisionsError } = await supabase.from("cash_closing_revisions").select("id,reason,actor_email,created_at").eq("day", day).order("created_at", {ascending:false})
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
        description="Saldo inicial más ingresos menos egresos vigentes. Ingresá el saldo contado por cada medio; una actualización conserva el cierre anterior."
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
        <SectionTitle aside={closing && <Badge tone={Object.keys(closing.counted).every(m => Number(closing.counted[m]) === Number(closing.expected[m])) ? "success" : "warning"}>Cerrado</Badge>}>
          {formatDate(day)}
        </SectionTitle>
        {closing && <p className="text-xs text-muted-foreground">Los movimientos históricos pudieron corregirse después del cierre. El esperado guardado se conserva en el historial; los importes de esta tabla muestran los movimientos vigentes. El saldo esperado incluye el inicial guardado.</p>}
        <ActionForm action={saveCashClosing} submitLabel={closing ? "Actualizar cierre" : "Guardar cierre"}>
          <input type="hidden" name="day" value={day} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2">Medio</th>
                  <th scope="col" className="py-2 pl-2">Saldo inicial</th><th scope="col" className="py-2 text-right">Entró</th>
                  <th scope="col" className="py-2 text-right">Salió</th>
                  <th scope="col" className="py-2 text-right">Esperado</th>
                  <th scope="col" className="py-2 pl-4">Contado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {methods.map(m=><ClosingMethodRow key={`${day}-${m}-${JSON.stringify(closing?.counted)}-${JSON.stringify(closing?.opening)}`} method={m} label={PAYMENT_METHOD[m]} income={income[m]} expenses={outflow[m]} opening={closing?.opening?.[m] ?? 0} counted={closing?.counted?.[m]} />)}
              </tbody>
            </table>
          </div>
          {closing && <Field label="Motivo de actualización" htmlFor="closing-reason"><input id="closing-reason" name="reason" required minLength={3} maxLength={300} className={fieldClass} /></Field>}
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
      {revisionsError ? <p role="alert" className="text-sm text-red-200">No se pudo consultar el historial de cierres (actualización 026).</p> : <details className="rounded-2xl border border-border p-4"><summary className="cursor-pointer">Historial de este cierre ({revisions?.length ?? 0})</summary><ul className="mt-3 space-y-2 text-sm">{revisions?.map(r=><li key={r.id}>{new Date(r.created_at).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})} · {r.actor_email ?? "Administrador"} · {r.reason ?? "Primer cierre"}</li>)}</ul></details>}
      <section className="flex flex-col gap-3">
        <SectionTitle>Cierres anteriores</SectionTitle>
        {(history ?? []).length === 0 ? (
          <EmptyState>Todavía no hay cierres guardados.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {(history ?? []).map((h) => (
              <li key={h.day} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                <a href={`/admin/cierre?dia=${h.day}`} className="font-medium hover:text-electric">{formatDate(h.day)}</a>
                <Badge tone={Object.keys(h.counted ?? {}).every(m => Number(h.counted[m]) === Number(h.expected?.[m])) ? "success" : "warning"}>
                  {Object.keys(h.counted ?? {}).every(m => Number(h.counted[m]) === Number(h.expected?.[m])) ? "Sin diferencias" : `Diferencia ${money(h.difference)}`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
