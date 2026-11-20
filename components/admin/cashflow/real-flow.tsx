"use client"

import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { RealFlow } from "@/lib/cashflow/real"
import type { Config } from "@/lib/cashflow/types"
import { Stat, fieldClass, secondaryButtonClass, primaryButtonClass } from "@/components/admin/ui"
import { LaborGuarantee } from "./labor-guarantee"
import { BreakdownBars, DailyChart, IncomeExpenseChart, PaybackChart, shortMonth } from "./real-charts"

const whole = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const money = (v: number) => whole.format(v)
const percent = (v: number) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`
const longMonth = (month: string) =>
  new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  })
const sourceLabel = { real: "Real", partial: "En curso", forecast: "Proyectado" }
const cell = "border-b border-border/60 px-3 py-2 text-right tabular-nums whitespace-nowrap"
const stickyCell = "sticky left-0 z-10 border-b border-border/60 bg-card px-3 py-2 text-left"

export function RealFlowTab({
  flow,
  washes,
  ticket,
  config,
  setConfig,
  canEdit,
  onOpenMaster,
}: {
  flow: RealFlow
  washes: number
  ticket: number | null
  config: Config
  setConfig: Dispatch<SetStateAction<Config>>
  canEdit: boolean
  onOpenMaster: () => void
}) {
  const currentMonth = flow.today.slice(0, 7)
  const [selected, setSelected] = useState(currentMonth)
  const [scope, setScope] = useState<"month" | "period">("period")
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const p = flow.period
  const margin = p.operatingIncome ? (p.operatingNet / p.operatingIncome) * 100 : 0
  const recoveredShare = flow.investmentTotal ? Math.min(100, (flow.recovered / flow.investmentTotal) * 100) : 0
  const worker = flow.sections.find((s) => s.key === "worker")
  const workerReal = worker
    ? flow.months.filter((m) => m.source !== "forecast").reduce((s, m) => s + (worker.values[m.month] ?? 0), 0)
    : 0
  const serviceDays = new Set(flow.movements.filter((m) => m.origin === "cobro" && !m.excluded).map((m) => m.date)).size

  const breakdown = (direction: "income" | "expense") => {
    const months = scope === "month" ? [selected] : flow.months.filter((m) => m.source !== "forecast").map((m) => m.month)
    return flow.sections
      .filter((s) => s.direction === direction)
      .flatMap((s) => s.lines)
      .map((l) => ({ label: l.label, value: months.reduce((sum, m) => sum + (l.values[m] ?? 0), 0) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }

  const monthMovements = flow.movements.filter((m) => m.month === selected)
  const needle = query.trim().toLowerCase()
  const visibleMovements = needle
    ? monthMovements.filter((m) =>
        `${m.concept} ${m.subconcept} ${m.detail}`.toLowerCase().includes(needle),
      )
    : monthMovements
  const days = useMemo(() => {
    const [y, mo] = selected.split("-").map(Number)
    const count = new Date(Date.UTC(y, mo, 0)).getUTCDate()
    return Array.from({ length: count }, (_, i) => {
      const date = `${selected}-${String(i + 1).padStart(2, "0")}`
      const rows = monthMovements.filter((m) => m.date === date && !m.excluded && m.section !== "investment")
      return {
        date,
        income: rows.filter((r) => r.direction === "income").reduce((s, r) => s + r.amount, 0),
        expense: rows.filter((r) => r.direction === "expense").reduce((s, r) => s + r.amount, 0),
      }
    })
  }, [monthMovements, selected])

  const toggleExcluded = (id: string) =>
    setConfig((c) => {
      const set = new Set(c.actual.excluded)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...c, actual: { ...c.actual, excluded: [...set] } }
    })
  const toggleLine = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const download = () => {
    const number = (n: number) => n.toFixed(2).replace(".", ",")
    const rows: string[][] = [["Sección", "Concepto", ...flow.months.map((m) => `${m.month} (${sourceLabel[m.source]})`)]]
    for (const s of flow.sections) {
      if (!s.lines.length) continue
      for (const l of s.lines) rows.push([s.label, l.label, ...flow.months.map((m) => number(l.values[m.month] ?? 0))])
      rows.push([s.label, `Total ${s.label}`, ...flow.months.map((m) => number(s.values[m.month] ?? 0))])
    }
    rows.push(["", "Resultado operativo", ...flow.months.map((m) => number(flow.totals[m.month].operatingNet))])
    rows.push(["", "Flujo neto", ...flow.months.map((m) => number(flow.totals[m.month].net))])
    rows.push(["", "Saldo acumulado", ...flow.months.map((m) => number(flow.totals[m.month].cumulative))])
    const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `MK-Cars-Flujo-real-${flow.today}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const summaryRows: [string, (m: string) => number, string?][] = [
    ["Resultado operativo", (m) => flow.totals[m].operatingNet, "font-semibold"],
    ["Flujo neto del mes", (m) => flow.totals[m].net],
    ["Saldo acumulado", (m) => flow.totals[m].cumulative, "font-semibold"],
  ]

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        {flow.firstDate
          ? `Datos reales del panel desde ${new Date(`${flow.firstDate}T12:00:00-03:00`).toLocaleDateString("es-AR")} hasta hoy (${flow.daysElapsed} días). `
          : "Todavía no hay movimientos registrados. "}
        Los meses proyectados usan el promedio real y los recurrentes cargados en Master.
      </p>

      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Resultado operativo acumulado"
          value={money(p.operatingNet)}
          hint={`Margen ${percent(margin)} sobre ${money(p.operatingIncome)} de ingresos`}
        />
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <dt className="text-xs text-muted-foreground">Recupero de la inversión</dt>
          <dd className="flex flex-col gap-2">
            {flow.investmentTotal > 0 ? (
              <>
                <span className="text-xl font-semibold tabular-nums">{percent(recoveredShare)}</span>
                <span
                  className="h-2 rounded-full bg-muted/40"
                  role="progressbar"
                  aria-valuenow={Math.round(recoveredShare)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Porcentaje recuperado"
                >
                  <span className="block h-2 rounded-full bg-electric" style={{ width: `${recoveredShare}%` }} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {money(Math.max(0, flow.recovered))} de {money(flow.investmentTotal)}
                </span>
              </>
            ) : (
              <button type="button" className="w-fit text-sm text-electric underline-offset-4 hover:underline" onClick={onOpenMaster}>
                Cargá la inversión real en Master
              </button>
            )}
          </dd>
        </div>
        <Stat
          label="Recupero estimado"
          value={
            flow.paybackMonths === null
              ? flow.investmentTotal
                ? "Sin margen positivo"
                : "—"
              : flow.paybackMonths === 0
                ? "Recuperada"
                : `${flow.paybackMonths.toLocaleString("es-AR", { maximumFractionDigits: 1 })} meses`
          }
          hint={flow.paybackMonth && flow.paybackMonths ? `Aprox. ${longMonth(flow.paybackMonth)} al ritmo actual` : "Al ritmo operativo actual"}
        />
        <Stat
          label="Resultado operativo mensual promedio"
          value={money(flow.monthly.operatingNet)}
          hint={`${money(flow.monthly.income)} ingresos − ${money(flow.monthly.expense)} egresos por mes`}
        />
        <Stat label="Ingreso promedio por día" value={money(flow.daily.income)} hint={`Egreso promedio ${money(flow.daily.expense)} por día`} />
        <Stat
          label="Lavados y ticket promedio"
          value={`${washes.toLocaleString("es-AR")} · ${ticket === null ? "—" : money(ticket)}`}
          hint={serviceDays ? `${(washes / serviceDays).toLocaleString("es-AR", { maximumFractionDigits: 1 })} lavados por día trabajado` : "Sin días con cobros"}
        />
        <Stat
          label="Peso del personal"
          value={percent(p.operatingIncome ? (workerReal / p.operatingIncome) * 100 : 0)}
          hint={`${money(workerReal)} en honorarios y comisiones`}
        />
        <Stat
          label="Saldo de caja estimado"
          value={money(p.cumulative)}
          hint="Saldo inicial + flujo neto, incluida la inversión"
        />
      </dl>

      <LaborGuarantee labor={flow.labor} />

      <IncomeExpenseChart months={flow.months} totals={flow.totals} selected={selected} onSelect={setSelected} />
      <PaybackChart months={flow.months} totals={flow.totals} investment={flow.investmentTotal} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">¿En qué se va y de dónde viene el dinero?</h2>
          <div className="flex gap-2" role="group" aria-label="Período del detalle">
            <button
              type="button"
              aria-pressed={scope === "period"}
              className={scope === "period" ? primaryButtonClass : secondaryButtonClass}
              onClick={() => setScope("period")}
            >
              Todo el período real
            </button>
            <button
              type="button"
              aria-pressed={scope === "month"}
              className={scope === "month" ? primaryButtonClass : secondaryButtonClass}
              onClick={() => setScope("month")}
            >
              {longMonth(selected)}
            </button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <BreakdownBars title="Egresos por concepto" rows={breakdown("expense")} tone="expense" money={money} />
          <BreakdownBars title="Ingresos por concepto" rows={breakdown("income")} tone="income" money={money} />
        </div>
      </div>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="real-table-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="real-table-title" className="font-semibold">
            Flujo de fondos real
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Tocá un concepto para ver sus subconceptos</span>
            <button type="button" className={secondaryButtonClass} onClick={download}>
              Exportar CSV
            </button>
          </div>
        </div>
        <div className="min-w-0 overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Flujo de fondos real por concepto y mes</caption>
            <thead>
              <tr>
                <th scope="col" className={`${stickyCell} min-w-56 text-xs font-medium text-muted-foreground`}>
                  Concepto
                </th>
                {flow.months.map((m) => (
                  <th key={m.month} scope="col" className={`${cell} text-xs font-medium ${m.month === selected ? "bg-primary/10" : ""}`}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-end gap-0.5"
                      aria-pressed={m.month === selected}
                      onClick={() => setSelected(m.month)}
                    >
                      <span className="capitalize text-foreground">{shortMonth(m.month)}</span>
                      <span className={m.source === "forecast" ? "text-amber-200/80" : "text-muted-foreground"}>
                        {sourceLabel[m.source]}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className={`${cell} text-xs font-medium text-muted-foreground`}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {flow.sections
                .filter((s) => s.lines.length > 0)
                .map((section) => (
                  <Fragment key={section.key}>
                    <tr>
                      <th
                        colSpan={flow.months.length + 2}
                        scope="colgroup"
                        className={`border-b border-border px-3 pt-4 pb-2 text-left text-xs font-semibold uppercase tracking-wide ${section.direction === "income" ? "text-emerald-300" : "text-red-200"}`}
                      >
                        {section.label}
                      </th>
                    </tr>
                    {section.lines.map((line) => {
                      const expanded = open.has(line.key)
                      return (
                        <Fragment key={line.key}>
                          <tr>
                            <th scope="row" className={`${stickyCell} font-normal`}>
                              {line.children.length ? (
                                <button
                                  type="button"
                                  aria-expanded={expanded}
                                  className="flex items-center gap-1 text-left hover:text-electric"
                                  onClick={() => toggleLine(line.key)}
                                >
                                  <ChevronRight
                                    aria-hidden="true"
                                    className={`size-3.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                                  />
                                  {line.label}
                                </button>
                              ) : (
                                <span className="pl-[18px]">{line.label}</span>
                              )}
                            </th>
                            {flow.months.map((m) => {
                              const v = line.values[m.month] ?? 0
                              return (
                                <td
                                  key={m.month}
                                  className={`${cell} ${line.projected[m.month] ? "italic text-muted-foreground" : ""} ${m.month === selected ? "bg-primary/10" : ""}`}
                                >
                                  {v ? money(v) : "—"}
                                </td>
                              )
                            })}
                            <td className={`${cell} font-medium`}>{money(line.total)}</td>
                          </tr>
                          {expanded &&
                            line.children.map((child) => (
                              <tr key={child.label} className="text-muted-foreground">
                                <th scope="row" className={`${stickyCell} pl-10 text-xs font-normal`}>
                                  {child.label}
                                </th>
                                {flow.months.map((m) => (
                                  <td key={m.month} className={`${cell} text-xs`}>
                                    {child.values[m.month] ? money(child.values[m.month]) : ""}
                                  </td>
                                ))}
                                <td className={`${cell} text-xs`}>{money(child.total)}</td>
                              </tr>
                            ))}
                        </Fragment>
                      )
                    })}
                    <tr className="bg-muted/20">
                      <th scope="row" className={`${stickyCell} bg-muted/20 font-semibold`}>
                        Total {section.label.toLowerCase()}
                      </th>
                      {flow.months.map((m) => (
                        <td key={m.month} className={`${cell} font-semibold`}>
                          {money(section.values[m.month] ?? 0)}
                        </td>
                      ))}
                      <td className={`${cell} font-semibold`}>{money(section.total)}</td>
                    </tr>
                  </Fragment>
                ))}
              <tr>
                <td colSpan={flow.months.length + 2} className="h-3" />
              </tr>
              {summaryRows.map(([label, value, extra]) => (
                <tr key={label}>
                  <th scope="row" className={`${stickyCell} ${extra ?? ""}`}>
                    {label}
                  </th>
                  {flow.months.map((m) => {
                    const v = value(m.month)
                    return (
                      <td key={m.month} className={`${cell} ${extra ?? ""} ${v < 0 ? "text-red-200" : "text-emerald-300"}`}>
                        {money(v)}
                      </td>
                    )
                  })}
                  <td className={cell} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Valores en cursiva = proyección. El saldo acumulado parte del saldo inicial de Master e incluye la inversión
          real cargada allí.{flow.breakEvenMonth ? ` El saldo vuelve a ser positivo en ${longMonth(flow.breakEvenMonth)}.` : ""}
        </p>
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="month-detail-title">
        <h2 id="month-detail-title" className="font-semibold capitalize">
          {longMonth(selected)} · día a día
        </h2>
        {selected > currentMonth ? (
          <p className="text-sm text-muted-foreground">Es un mes proyectado: todavía no tiene movimientos reales.</p>
        ) : (
          <>
            <DailyChart days={days} />
            <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  Buscar en los movimientos del mes
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ej: Rodrigo Aguilera, combustible"
                    className={fieldClass}
                  />
                </label>
                <Link
                  href={`/admin/finanzas?mes=${selected}`}
                  className="text-sm text-electric underline-offset-4 hover:underline"
                >
                  Editar movimientos en Finanzas
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                {visibleMovements.length} movimientos ·{" "}
                {money(visibleMovements.filter((m) => !m.excluded && m.direction === "income").reduce((s, m) => s + m.amount, 0))} ingresos ·{" "}
                {money(visibleMovements.filter((m) => !m.excluded && m.direction === "expense").reduce((s, m) => s + m.amount, 0))} egresos
                {canEdit ? " · Destildá un movimiento para sacarlo del flujo (por ejemplo, si está duplicado)." : ""}
              </p>
              <ul className="flex max-h-[520px] flex-col divide-y divide-border/60 overflow-y-auto">
                {visibleMovements.map((m) => (
                  <li key={m.id} className={`flex items-start gap-3 py-2.5 ${m.excluded ? "opacity-50" : ""}`}>
                    {m.ledger && (
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!m.excluded}
                        disabled={!canEdit}
                        aria-label={`Incluir ${m.concept} del ${m.date} en el flujo`}
                        onChange={() => toggleExcluded(m.id)}
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className={`truncate text-sm ${m.excluded ? "line-through" : ""}`}>
                        <strong className="font-medium">{m.concept}</strong>
                        {m.subconcept ? ` · ${m.subconcept}` : ""}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {m.date.split("-").reverse().join("/")}
                        {m.detail ? ` · ${m.detail}` : ""}
                        {!m.ledger ? " · cargado en Master" : ""}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-medium tabular-nums ${m.direction === "income" ? "text-emerald-300" : "text-red-200"}`}
                    >
                      {m.direction === "income" ? "+" : "−"}
                      {money(m.amount)}
                    </span>
                  </li>
                ))}
                {visibleMovements.length === 0 && (
                  <li className="py-6 text-center text-sm text-muted-foreground">Sin movimientos para mostrar.</li>
                )}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
