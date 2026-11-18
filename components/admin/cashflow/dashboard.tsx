"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { saveCashflow, type SaveState } from "@/app/admin/(panel)/flujo-de-fondos/actions"
import { buildCashflow } from "@/lib/cashflow/model"
import type { Config, Dataset, Month } from "@/lib/cashflow/types"
import { CashflowSettings } from "./settings"
import { CashflowChart } from "./chart"
import {
  Card,
  Stat,
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
  thClass,
  tdClass,
} from "@/components/admin/ui"

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const money = (v: number | null) => (v === null ? "—" : currency.format(v))
const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString("es-AR", {
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  })
const sourceLabel = { real: "Real registrado", partial: "Mes en curso", forecast: "Proyectado" }

export function CashflowDashboard({
  initialConfig,
  defaults,
  version: initialVersion,
  persisted,
  available,
  canEdit,
  data,
  today,
  observations,
  updatedAt,
}: {
  initialConfig: Config
  defaults: Config
  version: number
  persisted: boolean
  available: boolean
  canEdit: boolean
  data: Dataset
  today: string
  observations: string[]
  updatedAt: string | null
}) {
  const router = useRouter()
  const [config, setConfig] = useState(initialConfig)
  const [version, setVersion] = useState(initialVersion)
  const [saved, setSaved] = useState(JSON.stringify(initialConfig))
  const [state, save, pending] = useActionState<SaveState, FormData>(saveCashflow, { ok: false, message: null })
  useEffect(() => {
    if (state.ok && state.version) {
      setVersion(state.version)
      setSaved(JSON.stringify(config))
    }
  }, [state]) // form fields are disabled while saving
  const result = useMemo(() => {
    try {
      return { report: buildCashflow(config, data, today), error: null }
    } catch (error) {
      return { report: null, error: error instanceof Error ? error.message : "No se pudo calcular el modelo." }
    }
  }, [config, data, today])
  const report = result.report
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7))
  const selected = report?.rows.find((r) => r.month === selectedMonth) ?? report?.rows[0]
  const dirty = JSON.stringify(config) !== saved
  const download = () => {
    if (!report) return
    const header = [
      "Mes",
      "Origen",
      "Lavados",
      "Facturado por servicios",
      "Entradas de caja",
      "Gastos pagados",
      "Comisiones operarios registradas",
      "Comisiones cobro registradas",
      "Flujo neto",
      "Referencia proyectada",
      "Acumulado caja registrada/proyectada",
      "Inversion no vinculada del modelo",
      "Acumulado del modelo",
    ]
    const number = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","))
    const rows = report.rows.map((r) => [
      r.month,
      sourceLabel[r.source],
      number(r.selected.washes),
      number(r.selected.billed),
      number(r.selected.receipts),
      number(r.selected.expenses),
      r.source === "forecast" || r.selected.workerRecorded ? number(r.selected.worker) : "",
      r.source === "forecast" || r.selected.feesRecorded ? number(r.selected.fees) : "",
      number(r.selected.net),
      number(r.forecast.net),
      number(r.cumulative),
      number(r.modelInvestment),
      number(r.modeledCumulative),
    ])
    const csv =
      "\uFEFF" +
      [header, ...rows]
        .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
        .join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `MK-Cars-Flujo-${today}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {persisted || state.ok
            ? `Configuración guardada · versión ${version}`
            : "Supuestos originales del Excel · aún no guardados"}
          {updatedAt
            ? ` · ${new Date(updatedAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`
            : ""}
        </p>
        <div className="flex gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => router.refresh()}>
            Actualizar datos
          </button>
          <button type="button" className={secondaryButtonClass} onClick={download} disabled={!report}>
            Exportar CSV
          </button>
        </div>
      </div>
      {report && (
        <>
          <p className="text-sm text-muted-foreground">
            Historial desde {report.earliestDate ?? "el primer movimiento que registres"} hasta {today}. El plan
            conserva 24 meses desde {report.startMonth}; el historial anterior o posterior también se muestra.
          </p>
          <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Entradas de caja registradas"
              value={money(report.totals.receipts)}
              hint="Cobros + propinas + otros ingresos y aportes"
            />
            <Stat
              label="Salidas de caja registradas"
              value={money(report.totals.expenses)}
              hint="Solo gastos vigentes, inversión y retiros registrados"
            />
            <Stat
              label="Flujo neto registrado"
              value={money(report.totals.net)}
              hint="No incluye inversiones del Excel sin movimiento"
            />
            <Stat
              label="Lavados / ticket real"
              value={`${report.totals.washes} · ${money(report.totals.ticket)}`}
              hint={`${report.totals.jobs} trabajos · ticket = valor realizado / vehículos lavados`}
            />
          </dl>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
            <span className="mr-2 text-sm font-semibold">Escenario proyectado</span>
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
            <span className="text-xs text-muted-foreground">Cambiar de escenario no modifica movimientos reales.</span>
          </div>
          <CashflowChart rows={report.rows} onSelect={setSelectedMonth} />
          <section className="flex min-w-0 flex-col gap-3" aria-label="Detalle mensual del flujo">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-semibold">Mes a mes</h2>
              <p className="text-xs text-muted-foreground">
                Tocá un mes para ver su composición. Deslizá la tabla para ver todas las columnas.
              </p>
            </div>
            <div className="min-w-0 overflow-x-auto rounded-3xl border border-border bg-card">
              <table className="w-full min-w-[1140px] text-left text-sm">
                <caption className="sr-only">
                  Flujo de fondos real y proyectado, con referencia del modelo original
                </caption>
                <thead>
                  <tr>
                    {[
                      "Mes",
                      "Origen",
                      "Lavados",
                      "Cobros e ingresos",
                      "Gastos pagados",
                      "Flujo neto",
                      "Referencia del escenario",
                      "Inversión del modelo sin movimiento",
                      "Acumulado del modelo",
                    ].map((label) => (
                      <th scope="col" key={label} className={thClass}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.month} className={row.month === selectedMonth ? "bg-primary/10" : ""}>
                      <th scope="row" className={tdClass}>
                        <button
                          type="button"
                          className="text-left font-medium text-electric underline-offset-4 hover:underline"
                          onClick={() => setSelectedMonth(row.month)}
                        >
                          {monthLabel(row.month)}
                        </button>
                      </th>
                      <td className={`${tdClass} text-xs`}>{sourceLabel[row.source]}</td>
                      <td className={`${tdClass} tabular-nums`}>{row.selected.washes.toLocaleString("es-AR")}</td>
                      <td className={`${tdClass} tabular-nums`}>{money(row.selected.receipts)}</td>
                      <td className={`${tdClass} tabular-nums`}>{money(row.selected.expenses)}</td>
                      <td
                        className={`${tdClass} tabular-nums ${row.selected.net < 0 ? "text-red-200" : "text-emerald-300"}`}
                      >
                        {money(row.selected.net)}
                      </td>
                      <td className={`${tdClass} tabular-nums text-muted-foreground`}>{money(row.forecast.net)}</td>
                      <td className={`${tdClass} tabular-nums`}>
                        {row.modelInvestment ? money(row.modelInvestment) : "—"}
                      </td>
                      <td className={`${tdClass} tabular-nums`}>{money(row.modeledCumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              El flujo neto real no resta porcentajes estimados ni amortización. El acumulado del modelo sí descuenta la
              inversión sin movimiento como supuesto inicial y no representa el saldo bancario.
            </p>
          </section>
          {selected && <MonthDetail row={selected} partners={config.partners} />}
          <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat
              label="Inversión inicial del modelo"
              value={money(report.investmentTotal)}
              hint={`${money(report.unlinkedInvestment)} sin movimiento asociado`}
            />
            <Stat
              label="Flujo mensual del escenario"
              value={money(report.baselineMonth.net)}
              hint={`${report.baselineMonth.washes} lavados al ticket proyectado`}
            />
            <Stat
              label="Punto de equilibrio proyectado"
              value={
                report.breakEvenWashes === null ? "Sin margen suficiente" : `${report.breakEvenWashes} lavados/mes`
              }
              hint="Según costos y comisiones del modelo"
            />
            <Stat
              label="Recuperación operativa proyectada"
              value={report.modelPaybackMonth ? monthLabel(report.modelPaybackMonth) : "Fuera del horizonte"}
              hint="Depende de supuestos y gastos efectivamente registrados"
            />
          </dl>
          <p className="text-sm text-muted-foreground">
            Amortización económica estimada: {money(report.depreciation)}/mes (sin salida de caja). Inventario de
            referencia: {money(report.inventoryTotal)}; no se suma nuevamente a la inversión.
          </p>
          {report.warnings.length > 0 && (
            <details open className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
              <summary className="cursor-pointer font-medium">Datos a revisar ({report.warnings.length})</summary>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {report.warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {result.error && (
        <p role="alert" className="rounded-2xl border border-red-400/40 p-4 text-sm text-red-200">
          {result.error} Corregí los campos para volver a calcular; no se guardaron cambios.
        </p>
      )}
      <details className="rounded-3xl border border-border bg-card p-5">
        <summary className="cursor-pointer font-semibold">Editar supuestos e inversión</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          Los cambios recalculan el escenario en esta pantalla. Guardalos para compartirlos con el equipo. Los
          movimientos históricos se leen del panel y no se editan desde el modelo.
        </p>
        {!available && (
          <p role="status" className="mt-3 text-sm text-amber-200">
            El guardado del modelo todavía no está habilitado en este entorno. Podés simular cambios; no se conservarán
            al cerrar.
          </p>
        )}
        {!canEdit && (
          <p className="mt-3 text-sm text-muted-foreground">Solo el propietario puede modificar los supuestos.</p>
        )}
        <form action={save} noValidate className="mt-5 flex flex-col gap-5">
          <input type="hidden" name="config" value={JSON.stringify(config)} />
          <input type="hidden" name="version" value={version} />
          <CashflowSettings config={config} setConfig={setConfig} data={data} disabled={!canEdit || pending} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={!canEdit || !available || pending || !report}
            >
              {pending ? "Guardando…" : "Guardar supuestos"}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={!canEdit || pending}
              onClick={() => setConfig(structuredClone(defaults))}
            >
              Restaurar valores del Excel
            </button>
            {dirty && <span className="text-xs text-amber-200">Cambios sin guardar</span>}
            <p
              role="status"
              aria-live="polite"
              className={state.ok ? "text-sm text-emerald-300" : "text-sm text-red-200"}
            >
              {state.message}
            </p>
          </div>
        </form>
      </details>
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">Notas del Excel y criterio de cálculo</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {observations.map((note) => (
            <li key={note}>{note}</li>
          ))}
          <li>
            Los importes están expresados en pesos nominales. Cambiar inflación o costos solo altera las proyecciones.
          </li>
          <li>
            Los pagos se agrupan por fecha de cobro y los gastos por fecha de pago; el ticket se calcula por la fecha
            del trabajo realizado.
          </li>
          <li>Los registros anulados y los datos marcados como demo quedan excluidos.</li>
        </ul>
      </details>
    </div>
  )
}

function MonthDetail({ row, partners }: { row: Month; partners: Config["partners"] }) {
  const a = row.selected,
    forecast = row.source === "forecast"
  const entries: [string, number | null][] = [
    ["Valor de los trabajos realizados", a.billed],
    ["Cobros de servicios", a.serviceReceipts],
    ["Propinas recibidas", a.tips],
    ["Otros ingresos operativos", a.otherIncome],
    ["Aportes y financiación", a.capital],
    ["Productos y consumibles", a.materials],
    ["Comisiones / honorarios operarios", forecast || a.workerRecorded ? a.worker : null],
    ["Comisiones de cobro", forecast || a.feesRecorded ? a.fees : null],
    ["Gastos fijos pagados", a.fixed],
    ["Otros gastos operativos", a.operating],
    ["Inversiones pagadas registradas", a.investment],
    ["Retiros de socios", a.withdrawals],
  ]
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-semibold">
        Detalle · {monthLabel(row.month)} · {sourceLabel[row.source]}
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm tabular-nums">{value === null ? "Sin registro separado" : money(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        {forecast
          ? "Proyección, no movimiento bancario registrado."
          : "Solo movimientos vigentes registrados en este mes. Un servicio puede estar realizado y todavía no cobrado."}
      </p>
      {forecast && a.withdrawals > 0 && (
        <p className="text-sm">
          Reparto ilustrativo:{" "}
          {partners.map((p) => `${p.name}: ${money((a.withdrawals * p.percent) / 100)}`).join(" · ")}
        </p>
      )}
    </Card>
  )
}
