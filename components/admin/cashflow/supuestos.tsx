"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import type { RealFlow } from "@/lib/cashflow/real"
import type { Config, Dataset, Month, Report } from "@/lib/cashflow/types"
import { CashflowSettings } from "./settings"
import { CashflowChart } from "./chart"
import { Card, Stat, primaryButtonClass, secondaryButtonClass, thClass, tdClass } from "@/components/admin/ui"

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const money = (v: number | null) => (v === null ? "—" : currency.format(v))
const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  })
const sourceLabel = { real: "Real registrado", partial: "Mes en curso", forecast: "Proyectado" }

export function SupuestosTab({
  config,
  setConfig,
  report,
  flow,
  data,
  defaults,
  canEdit,
  pending,
  today,
  observations,
}: {
  config: Config
  setConfig: Dispatch<SetStateAction<Config>>
  report: Report
  flow: RealFlow | null
  data: Dataset
  defaults: Config
  canEdit: boolean
  pending: boolean
  today: string
  observations: string[]
}) {
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7))
  const selected = report.rows.find((r) => r.month === selectedMonth) ?? report.rows[0]
  const compared = flow ? report.rows.filter((r) => r.source !== "forecast" && flow.totals[r.month]) : []
  const totalReal = compared.reduce((s, r) => s + flow!.totals[r.month].net, 0)
  const totalModel = compared.reduce((s, r) => s + r.forecast.net, 0)
  const employeesPercent = config.employees.reduce((s, e) => s + e.percent, 0)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Los supuestos del plan original, con las comisiones actuales de los empleados (
        {config.employees.map((e) => `${e.name} ${e.percent}%`).join(" · ") || "sin empleados"}, total{" "}
        {employeesPercent}%). Sirven para comparar contra el flujo real; no modifican movimientos.
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
        <span className="mr-2 text-sm font-semibold">Escenario</span>
        {(
          [
            ["conservative", "Conservador"],
            ["moderate", "Moderado"],
            ["objective", "Objetivo"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={!canEdit || pending}
            aria-pressed={config.scenario === value}
            className={config.scenario === value ? primaryButtonClass : secondaryButtonClass}
            onClick={() => setConfig((c) => ({ ...c, scenario: value }))}
          >
            {label}
          </button>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Inversión inicial supuesta"
          value={money(report.investmentTotal)}
          hint={`${money(report.unlinkedInvestment)} sin movimiento asociado`}
        />
        <Stat
          label="Flujo mensual del escenario"
          value={money(report.baselineMonth.net)}
          hint={`${report.baselineMonth.washes} lavados al ticket proyectado`}
        />
        <Stat
          label="Punto de equilibrio supuesto"
          value={report.breakEvenWashes === null ? "Sin margen suficiente" : `${report.breakEvenWashes} lavados/mes`}
          hint="Según costos y comisiones del modelo"
        />
        <Stat
          label="Recuperación supuesta"
          value={report.modelPaybackMonth ? monthLabel(report.modelPaybackMonth) : "Fuera del horizonte"}
          hint="Según los supuestos del plan"
        />
      </dl>

      {flow && compared.length > 0 && (
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="compare-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="compare-title" className="font-semibold">
              Real vs. supuesto
            </h2>
            <p className="text-sm text-muted-foreground">
              Diferencia acumulada:{" "}
              <strong className={totalReal - totalModel < 0 ? "text-red-200" : "text-emerald-300"}>
                {money(totalReal - totalModel)}
              </strong>
            </p>
          </div>
          <div className="min-w-0 overflow-x-auto rounded-3xl border border-border bg-card">
            <table className="w-full min-w-[820px] text-left text-sm">
              <caption className="sr-only">Comparación mensual entre flujo real y supuestos</caption>
              <thead>
                <tr>
                  {[
                    "Mes",
                    "Ingresos reales",
                    "Ingresos supuestos",
                    "Egresos reales",
                    "Egresos supuestos",
                    "Neto real",
                    "Neto supuesto",
                    "Diferencia",
                  ].map((label) => (
                    <th key={label} scope="col" className={thClass}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compared.map((r) => {
                  const real = flow.totals[r.month]
                  const diff = real.net - r.forecast.net
                  return (
                    <tr key={r.month}>
                      <th scope="row" className={`${tdClass} font-medium capitalize`}>
                        {monthLabel(r.month)}
                        {r.source === "partial" ? " (en curso)" : ""}
                      </th>
                      <td className={`${tdClass} tabular-nums`}>{money(real.income)}</td>
                      <td className={`${tdClass} tabular-nums text-muted-foreground`}>{money(r.forecast.receipts)}</td>
                      <td className={`${tdClass} tabular-nums`}>{money(real.expense)}</td>
                      <td className={`${tdClass} tabular-nums text-muted-foreground`}>{money(r.forecast.expenses)}</td>
                      <td className={`${tdClass} tabular-nums`}>{money(real.net)}</td>
                      <td className={`${tdClass} tabular-nums text-muted-foreground`}>{money(r.forecast.net)}</td>
                      <td className={`${tdClass} tabular-nums ${diff < 0 ? "text-red-200" : "text-emerald-300"}`}>
                        {money(diff)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Lo real incluye la inversión cargada en Master en su mes. El mes en curso compara un mes parcial contra un mes
            supuesto completo.
          </p>
        </section>
      )}

      <CashflowChart rows={report.rows} onSelect={setSelectedMonth} />
      <section className="flex min-w-0 flex-col gap-3" aria-label="Detalle mensual de los supuestos">
        <h2 className="font-semibold">Plan mes a mes</h2>
        <div className="min-w-0 overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Plan de supuestos por mes</caption>
            <thead>
              <tr>
                {["Mes", "Origen", "Lavados supuestos", "Ingresos supuestos", "Egresos supuestos", "Neto supuesto", "Acumulado del modelo"].map(
                  (label) => (
                    <th scope="col" key={label} className={thClass}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.month} className={row.month === selectedMonth ? "bg-primary/10" : ""}>
                  <th scope="row" className={tdClass}>
                    <button
                      type="button"
                      className="text-left font-medium capitalize text-electric underline-offset-4 hover:underline"
                      onClick={() => setSelectedMonth(row.month)}
                    >
                      {monthLabel(row.month)}
                    </button>
                  </th>
                  <td className={`${tdClass} text-xs`}>{sourceLabel[row.source]}</td>
                  <td className={`${tdClass} tabular-nums`}>{row.forecast.washes.toLocaleString("es-AR")}</td>
                  <td className={`${tdClass} tabular-nums`}>{money(row.forecast.receipts)}</td>
                  <td className={`${tdClass} tabular-nums`}>{money(row.forecast.expenses)}</td>
                  <td className={`${tdClass} tabular-nums ${row.forecast.net < 0 ? "text-red-200" : "text-emerald-300"}`}>
                    {money(row.forecast.net)}
                  </td>
                  <td className={`${tdClass} tabular-nums`}>{money(row.modeledCumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selected && <MonthDetail row={selected} />}
      {report.warnings.length > 0 && (
        <details className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <summary className="cursor-pointer font-medium">Datos a revisar ({report.warnings.length})</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {report.warnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </details>
      )}
      <details className="rounded-3xl border border-border bg-card p-5">
        <summary className="cursor-pointer font-semibold">Editar supuestos</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          Los cambios recalculan el plan al instante. Usá “Guardar cambios” arriba para conservarlos.
        </p>
        <div className="mt-5 flex flex-col gap-5">
          <CashflowSettings config={config} setConfig={setConfig} data={data} disabled={!canEdit || pending} />
          <button
            type="button"
            className={`${secondaryButtonClass} w-fit`}
            disabled={!canEdit || pending}
            onClick={() =>
              setConfig((c) => ({
                ...structuredClone(defaults),
                employees: c.employees,
                actual: c.actual,
                rules: c.rules,
              }))
            }
          >
            Restaurar supuestos del Excel
          </button>
        </div>
      </details>
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">Notas del Excel y criterio de cálculo</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {observations.map((note) => (
            <li key={note}>{note}</li>
          ))}
          <li>Importes en pesos nominales. La comisión de personal es la suma de las comisiones de cada empleado.</li>
        </ul>
      </details>
    </div>
  )
}

function MonthDetail({ row }: { row: Month }) {
  const f = row.forecast
  const entries: [string, number][] = [
    ["Lavados supuestos", f.washes],
    ["Ingresos supuestos", f.receipts],
    ["Personal (comisiones)", f.worker],
    ["Comisiones de cobro", f.fees],
    ["Productos", f.materials],
    ["Gastos fijos", f.fixed],
    ["Neto supuesto", f.net],
  ]
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-semibold capitalize">Supuesto · {monthLabel(row.month)}</h2>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {entries.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm tabular-nums">{label === "Lavados supuestos" ? value.toLocaleString("es-AR") : money(value)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
