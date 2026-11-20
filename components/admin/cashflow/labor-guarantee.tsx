import type { LaborMonth } from "@/lib/cashflow/real"

const whole = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const money = (v: number) => whole.format(v)
const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  })

export function LaborGuarantee({ labor }: { labor: LaborMonth[] }) {
  const guaranteed = labor.filter((m) => m.employees.some((e) => e.minimum > 0))
  if (!guaranteed.length) return null
  const totalComplement = guaranteed.reduce((s, m) => s + m.complement, 0)

  return (
    <section aria-labelledby="labor-guarantee-title" className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 id="labor-guarantee-title" className="text-sm font-semibold text-foreground">
          Mínimo garantizado del personal
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cada empleado cobra su comisión o el mínimo, lo que sea mayor. La diferencia la pone el negocio y se proyecta
          como &ldquo;Complemento mínimo garantizado&rdquo; dentro de cada empleado en la tabla del flujo. Total
          estimado a completar: <strong className="text-foreground">{money(totalComplement)}</strong>.
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {guaranteed.map((m) => (
          <li key={m.month} className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium capitalize text-foreground">
                {monthName(m.month)}
                <span className="ml-2 text-xs font-normal normal-case text-muted-foreground">
                  {m.estimated ? "en curso, estimado al ritmo actual" : "proyectado"}
                </span>
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">Ventas {money(m.sales)}</span>
            </div>
            <div className="flex flex-col gap-1">
              {m.employees
                .filter((e) => e.minimum > 0)
                .map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
                    <span className="min-w-0 truncate text-foreground">{e.name.replace(/^empleado\s*\d+\s*·\s*/i, "")}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {money(e.commission)} comisión
                      {e.complement > 0 ? (
                        <>
                          {" + "}
                          <span className="font-medium text-destructive">{money(e.complement)} complemento</span>
                        </>
                      ) : (
                        <span className="font-medium text-emerald-700"> · supera el mínimo</span>
                      )}
                    </span>
                  </div>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
