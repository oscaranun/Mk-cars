"use client"

import { useId } from "react"
import type { MonthInfo, MonthTotals } from "@/lib/cashflow/real"

const COLORS = { income: "#38d9a9", expense: "#f87171", line: "#20b8ff", muted: "#6b8298", text: "#9cb7d1" }
export const compactMoney = (v: number) => {
  const abs = Math.abs(v)
  const text =
    abs >= 1e6
      ? `${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`
      : abs >= 1000
        ? `${(v / 1000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} mil`
        : v.toLocaleString("es-AR", { maximumFractionDigits: 0 })
  return `$ ${text}`
}
export const shortMonth = (month: string) =>
  new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  })

function ChartFrame({ title, legend, children }: { title: string; legend: React.ReactNode; children: React.ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-3xl border border-border bg-card p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <span className="flex flex-wrap gap-3 text-xs text-muted-foreground">{legend}</span>
      </figcaption>
      {children}
    </figure>
  )
}
const Swatch = ({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) => (
  <span className="flex items-center gap-1.5">
    <span
      aria-hidden="true"
      className="inline-block h-2 w-4 rounded-sm"
      style={dashed ? { borderTop: `2px dashed ${color}` } : { background: color }}
    />
    {label}
  </span>
)
function scale(values: number[]) {
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values)
  return { min, max, span: max - min || 1 }
}

export function IncomeExpenseChart({
  months,
  totals,
  selected,
  onSelect,
}: {
  months: MonthInfo[]
  totals: Record<string, MonthTotals>
  selected: string
  onSelect: (month: string) => void
}) {
  const id = useId()
  const values = months.flatMap(({ month }) => [
    totals[month].operatingIncome,
    totals[month].operatingExpense,
    totals[month].operatingNet,
  ])
  const { min, span } = scale(values)
  const width = 960,
    left = 70,
    top = 10,
    height = 190
  const slot = (width - left - 10) / Math.max(1, months.length)
  const bar = Math.min(28, slot / 3)
  const y = (v: number) => top + height - ((v - min) / span) * height
  const netPath = months
    .map(({ month }, i) => `${i ? "L" : "M"}${left + slot * i + slot / 2},${y(totals[month].operatingNet)}`)
    .join(" ")
  return (
    <ChartFrame
      title="Ingresos vs. egresos operativos"
      legend={
        <>
          <Swatch color={COLORS.income} label="Ingresos" />
          <Swatch color={COLORS.expense} label="Egresos" />
          <Swatch color={COLORS.line} label="Resultado" />
          <span>Barras claras = proyección</span>
        </>
      }
    >
      <svg viewBox={`0 0 ${width} 230`} className="w-full" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>Ingresos y egresos operativos por mes. Los valores están en la planilla.</title>
        {[min, min + span / 2, min + span].map((v) => (
          <g key={v}>
            <line x1={left} x2={width - 10} y1={y(v)} y2={y(v)} stroke={COLORS.muted} strokeOpacity="0.25" />
            <text x={left - 6} y={y(v) + 4} textAnchor="end" fill={COLORS.text} fontSize="11">
              {compactMoney(v)}
            </text>
          </g>
        ))}
        <line x1={left} x2={width - 10} y1={y(0)} y2={y(0)} stroke={COLORS.muted} />
        {months.map(({ month, source }, i) => {
          const t = totals[month]
          const x = left + slot * i + slot / 2
          const opacity = source === "forecast" ? 0.35 : 1
          return (
            <g
              key={month}
              role="button"
              tabIndex={0}
              aria-label={`Ver ${shortMonth(month)}`}
              aria-pressed={month === selected}
              onClick={() => onSelect(month)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(month)
                }
              }}
              className="cursor-pointer outline-none"
            >
              {month === selected && (
                <rect x={x - slot / 2 + 2} y={top} width={slot - 4} height={height} fill={COLORS.line} opacity="0.08" rx="6" />
              )}
              <rect
                x={x - bar - 1}
                y={y(t.operatingIncome)}
                width={bar}
                height={Math.max(0, y(0) - y(t.operatingIncome))}
                fill={COLORS.income}
                opacity={opacity}
                rx="3"
              />
              <rect
                x={x + 1}
                y={y(t.operatingExpense)}
                width={bar}
                height={Math.max(0, y(0) - y(t.operatingExpense))}
                fill={COLORS.expense}
                opacity={opacity}
                rx="3"
              />
              {(months.length <= 12 || i % Math.ceil(months.length / 12) === 0) && (
                <text x={x} y="222" textAnchor="middle" fill={COLORS.text} fontSize="11">
                  {shortMonth(month)}
                </text>
              )}
            </g>
          )
        })}
        <path d={netPath} fill="none" stroke={COLORS.line} strokeWidth="2.5" />
        {months.map(({ month }, i) => (
          <circle key={month} cx={left + slot * i + slot / 2} cy={y(totals[month].operatingNet)} r="3.5" fill={COLORS.line} />
        ))}
      </svg>
    </ChartFrame>
  )
}

export function PaybackChart({
  months,
  totals,
  investment,
}: {
  months: MonthInfo[]
  totals: Record<string, MonthTotals>
  investment: number
}) {
  const id = useId()
  const values = [investment, ...months.map(({ month }) => totals[month].recovered)]
  const { min, span } = scale(values)
  const width = 960,
    left = 70,
    top = 10,
    height = 170
  const x = (i: number) => left + (i / Math.max(1, months.length - 1)) * (width - left - 20)
  const y = (v: number) => top + height - ((v - min) / span) * height
  const firstFuture = months.findIndex((m) => m.source === "forecast")
  const pts = months.map(({ month }, i) => `${x(i)},${y(totals[month].recovered)}`)
  const real = firstFuture < 0 ? pts : pts.slice(0, firstFuture)
  const future = firstFuture < 0 ? [] : pts.slice(Math.max(0, firstFuture - 1))
  return (
    <ChartFrame
      title="Recupero de la inversión"
      legend={
        <>
          <Swatch color={COLORS.line} label="Resultado operativo acumulado" />
          <Swatch color={COLORS.line} label="Proyectado" dashed />
          <Swatch color="#fbbf24" label="Inversión total" dashed />
        </>
      }
    >
      <svg viewBox={`0 0 ${width} 210`} className="w-full" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>Resultado operativo acumulado frente a la inversión total</title>
        {[min, min + span / 2, min + span].map((v) => (
          <text key={v} x={left - 6} y={y(v) + 4} textAnchor="end" fill={COLORS.text} fontSize="11">
            {compactMoney(v)}
          </text>
        ))}
        <line x1={left} x2={width - 20} y1={y(0)} y2={y(0)} stroke={COLORS.muted} />
        {investment > 0 && (
          <line
            x1={left}
            x2={width - 20}
            y1={y(investment)}
            y2={y(investment)}
            stroke="#fbbf24"
            strokeDasharray="6 5"
            strokeWidth="2"
          />
        )}
        {real.length > 0 && (
          <polyline points={real.join(" ")} fill="none" stroke={COLORS.line} strokeWidth="3" />
        )}
        {future.length > 1 && (
          <polyline points={future.join(" ")} fill="none" stroke={COLORS.line} strokeWidth="3" strokeDasharray="7 5" />
        )}
        {months.map(({ month }, i) =>
          months.length <= 12 || i % Math.ceil(months.length / 12) === 0 ? (
            <text key={month} x={x(i)} y="202" textAnchor="middle" fill={COLORS.text} fontSize="11">
              {shortMonth(month)}
            </text>
          ) : null,
        )}
      </svg>
    </ChartFrame>
  )
}

export function BreakdownBars({
  title,
  rows,
  tone,
  money,
}: {
  title: string
  rows: { label: string; value: number }[]
  tone: "income" | "expense"
  money: (v: number) => string
}) {
  const total = rows.reduce((s, r) => s + r.value, 0)
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ChartFrame title={title} legend={<span>Total {money(total)}</span>}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos en el período.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex flex-col gap-1">
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {money(r.value)} · {total ? Math.round((r.value / total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/40">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${(r.value / max) * 100}%`, background: COLORS[tone] }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  )
}

export function DailyChart({ days }: { days: { date: string; income: number; expense: number }[] }) {
  const id = useId()
  const values = days.flatMap((d) => [d.income, -d.expense])
  const { min, span } = scale(values)
  const width = 960,
    left = 70,
    top = 10,
    height = 150
  const slot = (width - left - 10) / Math.max(1, days.length)
  const y = (v: number) => top + height - ((v - min) / span) * height
  return (
    <ChartFrame
      title="Movimiento diario del mes"
      legend={
        <>
          <Swatch color={COLORS.income} label="Ingresos" />
          <Swatch color={COLORS.expense} label="Egresos" />
        </>
      }
    >
      <svg viewBox={`0 0 ${width} 190`} className="w-full" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>Ingresos hacia arriba y egresos hacia abajo, por día</title>
        {[min, min + span / 2, min + span].map((v) => (
          <text key={v} x={left - 6} y={y(v) + 4} textAnchor="end" fill={COLORS.text} fontSize="11">
            {compactMoney(v)}
          </text>
        ))}
        <line x1={left} x2={width - 10} y1={y(0)} y2={y(0)} stroke={COLORS.muted} />
        {days.map((d, i) => {
          const x = left + slot * i + slot * 0.15
          const w = slot * 0.7
          return (
            <g key={d.date}>
              <rect x={x} y={y(d.income)} width={w} height={Math.max(0, y(0) - y(d.income))} fill={COLORS.income} rx="2" />
              <rect x={x} y={y(0)} width={w} height={Math.max(0, y(-d.expense) - y(0))} fill={COLORS.expense} rx="2" />
              {(days.length <= 16 || i % 2 === 0) && (
                <text x={x + w / 2} y="184" textAnchor="middle" fill={COLORS.text} fontSize="10">
                  {Number(d.date.slice(8))}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </ChartFrame>
  )
}
