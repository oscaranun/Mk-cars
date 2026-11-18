"use client"

import { useId, useState } from "react"
import type { Month } from "@/lib/cashflow/types"
import { secondaryButtonClass } from "@/components/admin/ui"

export function CashflowChart({ rows, onSelect }: { rows: Month[]; onSelect: (month: string) => void }) {
  const id = useId()
  const [mode, setMode] = useState<"net" | "cumulative">("net")
  const actual = (r: Month) => (mode === "net" ? r.selected.net : r.modeledCumulative)
  const baseline = (r: Month) => (mode === "net" ? r.forecast.net : r.baselineCumulative)
  const values = [0, ...rows.flatMap((r) => [actual(r), baseline(r)])]
  const min = Math.min(...values),
    max = Math.max(...values),
    span = max - min || 1
  const unit =
    Math.max(Math.abs(min), Math.abs(max)) >= 1e6 ? 1e6 : Math.max(Math.abs(min), Math.abs(max)) >= 1000 ? 1000 : 1
  const unitLabel = unit === 1e6 ? "M" : unit === 1000 ? "mil" : ""
  const x = (i: number) => 60 + (i / Math.max(1, rows.length - 1)) * 860
  const y = (v: number) => 205 - ((v - min) / span) * 170
  const path = (subset: { r: Month; i: number }[], value: (r: Month) => number) =>
    subset.map(({ r, i }, n) => `${n ? "L" : "M"}${x(i).toFixed(2)},${y(value(r)).toFixed(2)}`).join(" ")
  const points = rows.map((r, i) => ({ r, i })),
    firstFuture = rows.findIndex((r) => r.source === "forecast")
  const real = firstFuture < 0 ? points : points.slice(0, firstFuture)
  const future = firstFuture < 0 ? [] : points.slice(Math.max(0, firstFuture - 1))
  return (
    <div className="min-w-0 rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Evolución de caja</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={mode === "net"}
            className={secondaryButtonClass}
            onClick={() => setMode("net")}
          >
            Flujo mensual
          </button>
          <button
            type="button"
            aria-pressed={mode === "cumulative"}
            className={secondaryButtonClass}
            onClick={() => setMode("cumulative")}
          >
            Acumulado del modelo
          </button>
        </div>
      </div>
      <svg viewBox="0 0 960 245" className="w-full" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>
          {mode === "net" ? "Flujo neto de caja mensual" : "Acumulado del modelo con inversión inicial"}
        </title>
        <desc id={`${id}-description`}>
          Azul continuo: datos reales registrados. Azul discontinuo: meses proyectados. Gris: referencia del escenario.
          Los valores también están en la tabla mensual.
        </desc>
        <line x1="60" x2="920" y1={y(0)} y2={y(0)} stroke="#6b8298" strokeWidth="1" />
        {[min, (min + max) / 2, max].map((v, i) => (
          <text key={i} x="4" y={y(v) + 4} fill="#9cb7d1" fontSize="11">
            {(v / unit).toLocaleString("es-AR", { maximumFractionDigits: 1 })} {unitLabel}
          </text>
        ))}
        <path d={path(points, baseline)} fill="none" stroke="#8294a5" strokeDasharray="3 5" strokeWidth="2" />
        <path d={path(real, actual)} fill="none" stroke="#20b8ff" strokeWidth="3" />
        <path d={path(future, actual)} fill="none" stroke="#20b8ff" strokeDasharray="7 5" strokeWidth="3" />
        {points.map(({ r, i }) => (
          <g key={r.month}>
            <circle
              cx={x(i)}
              cy={y(actual(r))}
              r="4"
              fill={r.source === "forecast" ? "#20b8ff" : "#38d9a9"}
              role="button"
              tabIndex={0}
              aria-label={`Ver detalle ${r.month}`}
              onClick={() => onSelect(r.month)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(r.month)
                }
              }}
            />
            {(i === 0 || i === rows.length - 1 || i % Math.max(1, Math.ceil(rows.length / 6)) === 0) && (
              <text x={x(i)} y="230" textAnchor="middle" fill="#9cb7d1" fontSize="11">
                {r.month}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="text-xs text-muted-foreground">
        Importes en {unit === 1e6 ? "millones de pesos" : unit === 1000 ? "miles de pesos" : "pesos"}.{" "}
        {mode === "cumulative"
          ? "El acumulado del modelo descuenta la inversión no vinculada del Excel como supuesto; no equivale al saldo bancario."
          : "Los meses en curso muestran solo lo registrado hasta hoy; no se completan con costos estimados."}
      </p>
    </div>
  )
}
