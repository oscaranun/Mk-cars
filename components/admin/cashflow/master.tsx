"use client"

import { useId, type Dispatch, type ReactNode, type SetStateAction } from "react"
import type { ActualSetup, Bucket, Config, Dataset } from "@/lib/cashflow/types"
import { EXPENSE_SECTIONS, INCOME_SECTIONS, SECTION_LABELS } from "@/lib/cashflow/real"
import { EmployeesEditor, Numeric, RulesEditor, Text } from "./settings"
import { fieldClass, secondaryButtonClass } from "@/components/admin/ui"

type Props = {
  config: Config
  setConfig: Dispatch<SetStateAction<Config>>
  data: Dataset
  disabled: boolean
  today: string
  money: (v: number) => string
}

function Block({ title, description, aside, children }: { title: string; description: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function MonthField({ label, value, onChange, optional }: { label: string; value: string | null; onChange: (v: string | null) => void; optional?: boolean }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        id={id}
        type="month"
        value={value ?? ""}
        required={!optional}
        onChange={(e) => onChange(e.target.value || null)}
        className={fieldClass}
      />
    </label>
  )
}

function BucketSelect({ value, onChange }: { value: Bucket; onChange: (b: Bucket) => void }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      Sección
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as Bucket)} className={fieldClass}>
        <optgroup label="Ingresos">
          {INCOME_SECTIONS.filter((s) => s !== "sales").map((s) => (
            <option key={s} value={s}>
              {SECTION_LABELS[s]}
            </option>
          ))}
        </optgroup>
        <optgroup label="Egresos">
          {EXPENSE_SECTIONS.map((s) => (
            <option key={s} value={s}>
              {SECTION_LABELS[s]}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  )
}

export function CashflowMaster({ config, setConfig, data, disabled, today, money }: Props) {
  const actual = config.actual
  const setActual = (patch: Partial<ActualSetup>) => setConfig((c) => ({ ...c, actual: { ...c.actual, ...patch } }))
  const patchRow = <K extends "investments" | "recurring" | "adjustments">(
    key: K,
    index: number,
    patch: Partial<ActualSetup[K][number]>,
  ) =>
    setConfig((c) => ({
      ...c,
      actual: { ...c.actual, [key]: c.actual[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) },
    }))
  const removeRow = (key: "investments" | "recurring" | "adjustments", index: number) =>
    setConfig((c) => ({ ...c, actual: { ...c.actual, [key]: c.actual[key].filter((_, i) => i !== index) } }))
  const currentMonth = today.slice(0, 7)
  const investmentTotal = actual.investments.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0)
  const concepts = [
    ...new Set([
      ...data.expenses.filter((e) => !e.voided_at && !e.is_demo).map((e) => e.description?.trim() || e.category),
      ...data.incomes.filter((i) => !i.is_demo).map((i) => i.concept),
    ]),
  ].sort((a, b) => a.localeCompare(b))
  const copyFromModel = () =>
    setActual({
      investments: config.investments
        .filter((row) => row.amount !== null && row.amount > 0)
        .map((row) => ({
          id: crypto.randomUUID(),
          label: row.label,
          amount: row.amount ?? 0,
          date: `${actual.startMonth ?? config.startMonth ?? currentMonth}-01`,
          paidBy: row.paidBy,
          note: row.note,
        })),
    })

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-5 disabled:opacity-70">
      <datalist id="master-concepts">
        {concepts.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Block
        title="Datos base del flujo real"
        description="Desde cuándo se arma la planilla, con cuánto dinero arrancó la caja y cuántos meses se proyectan hacia adelante."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MonthField
            label="Inicio real del negocio (vacío = primer movimiento)"
            value={actual.startMonth}
            optional
            onChange={(startMonth) => setActual({ startMonth })}
          />
          <Numeric
            label="Saldo de caja inicial"
            value={actual.openingCash}
            min={-1e12}
            onChange={(openingCash) => setActual({ openingCash })}
          />
          <Numeric
            label="Meses a proyectar"
            value={actual.horizon}
            max={24}
            step="1"
            onChange={(horizon) => setActual({ horizon })}
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={actual.autoProject}
              onChange={(e) => setActual({ autoProject: e.target.checked })}
            />
            Proyectar con el promedio real
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Con la proyección activada, cada concepto operativo se proyecta según su promedio diario real. Si cargás un
          recurrente con el mismo concepto, el recurrente reemplaza al promedio.
        </p>
      </Block>

      <Block
        title="Inversión inicial real"
        description="Lo que efectivamente se invirtió. Se descuenta del flujo en su fecha y es la base para calcular el recupero."
        aside={<span className="text-sm font-semibold tabular-nums">Total {money(investmentTotal)}</span>}
      >
        {actual.investments.length === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Todavía no cargaste la inversión real.
            <button type="button" className={secondaryButtonClass} onClick={copyFromModel}>
              Copiar desde los supuestos para editar
            </button>
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {actual.investments.map((row, index) => (
            <li
              key={row.id}
              className="grid items-end gap-2 rounded-2xl border border-border/70 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_2fr_auto]"
            >
              <Text label="Concepto" value={row.label} onChange={(label) => patchRow("investments", index, { label })} />
              <Numeric label="Importe" value={row.amount} onChange={(amount) => patchRow("investments", index, { amount })} />
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                Fecha
                <input
                  type="date"
                  value={row.date}
                  onChange={(e) => patchRow("investments", index, { date: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <Text label="Aportó" value={row.paidBy} onChange={(paidBy) => patchRow("investments", index, { paidBy })} />
              <Text label="Nota" value={row.note} onChange={(note) => patchRow("investments", index, { note })} />
              <button
                type="button"
                className={secondaryButtonClass}
                aria-label={`Quitar ${row.label}`}
                onClick={() => removeRow("investments", index)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${secondaryButtonClass} w-fit`}
          onClick={() =>
            setActual({
              investments: [
                ...actual.investments,
                { id: crypto.randomUUID(), label: "Nueva inversión", amount: 0, date: today, paidBy: "", note: "" },
              ],
            })
          }
        >
          Agregar inversión
        </button>
        <p className="text-xs text-muted-foreground">
          Si una compra de inversión también figura como gasto en Finanzas, excluí ese gasto desde la planilla del flujo
          real para no descontarla dos veces.
        </p>
      </Block>

      <Block
        title="Empleados"
        description="Comisión vigente de cada empleado. Se usa en la solapa Supuestos para proyectar el costo de personal."
      >
        <EmployeesEditor config={config} setConfig={setConfig} />
      </Block>

      <Block
        title="Ingresos y gastos recurrentes"
        description="Montos fijos que se repiten cada mes (alquiler, internet, sueldo fijo, un ingreso mensual). Se suman a los meses proyectados."
      >
        <ul className="flex flex-col gap-3">
          {actual.recurring.map((row, index) => (
            <li
              key={row.id}
              className="grid items-end gap-2 rounded-2xl border border-border/70 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto]"
            >
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                Concepto
                <input
                  list="master-concepts"
                  value={row.label}
                  maxLength={200}
                  onChange={(e) => patchRow("recurring", index, { label: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <BucketSelect value={row.bucket} onChange={(bucket) => patchRow("recurring", index, { bucket })} />
              <Numeric label="Importe mensual" value={row.amount} onChange={(amount) => patchRow("recurring", index, { amount })} />
              <MonthField label="Desde" value={row.startMonth} onChange={(v) => patchRow("recurring", index, { startMonth: v ?? currentMonth })} />
              <MonthField label="Hasta (opcional)" value={row.endMonth} optional onChange={(endMonth) => patchRow("recurring", index, { endMonth })} />
              <button
                type="button"
                className={secondaryButtonClass}
                aria-label={`Quitar ${row.label}`}
                onClick={() => removeRow("recurring", index)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["fixed", "Agregar gasto recurrente"],
              ["other_income", "Agregar ingreso recurrente"],
            ] as const
          ).map(([bucket, label]) => (
            <button
              key={bucket}
              type="button"
              className={secondaryButtonClass}
              onClick={() =>
                setActual({
                  recurring: [
                    ...actual.recurring,
                    {
                      id: crypto.randomUUID(),
                      label: "",
                      bucket,
                      amount: 0,
                      startMonth: currentMonth,
                      endMonth: null,
                      note: "",
                    },
                  ],
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </Block>

      <Block
        title="Ajustes puntuales"
        description="Movimientos de un solo mes que no están en Finanzas: un pago futuro conocido, una corrección o un ingreso extraordinario."
      >
        <ul className="flex flex-col gap-3">
          {actual.adjustments.map((row, index) => (
            <li
              key={row.id}
              className="grid items-end gap-2 rounded-2xl border border-border/70 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_2fr_2fr_1fr_2fr_auto]"
            >
              <MonthField label="Mes" value={row.month} onChange={(v) => patchRow("adjustments", index, { month: v ?? currentMonth })} />
              <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                Concepto
                <input
                  list="master-concepts"
                  value={row.label}
                  maxLength={200}
                  onChange={(e) => patchRow("adjustments", index, { label: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <BucketSelect value={row.bucket} onChange={(bucket) => patchRow("adjustments", index, { bucket })} />
              <Numeric label="Importe" value={row.amount} onChange={(amount) => patchRow("adjustments", index, { amount })} />
              <Text label="Nota" value={row.note} onChange={(note) => patchRow("adjustments", index, { note })} />
              <button
                type="button"
                className={secondaryButtonClass}
                aria-label={`Quitar ${row.label}`}
                onClick={() => removeRow("adjustments", index)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${secondaryButtonClass} w-fit`}
          onClick={() =>
            setActual({
              adjustments: [
                ...actual.adjustments,
                { id: crypto.randomUUID(), month: currentMonth, label: "", bucket: "operating", amount: 0, note: "" },
              ],
            })
          }
        >
          Agregar ajuste
        </button>
      </Block>

      <Block
        title="Clasificación de conceptos"
        description="Define en qué sección del flujo cae cada concepto cargado en Finanzas (personal, productos, fijos, inversión, retiros, aportes)."
        aside={
          actual.excluded.length > 0 ? (
            <button type="button" className={secondaryButtonClass} onClick={() => setActual({ excluded: [] })}>
              Volver a incluir {actual.excluded.length} movimiento{actual.excluded.length === 1 ? "" : "s"} excluido
              {actual.excluded.length === 1 ? "" : "s"}
            </button>
          ) : undefined
        }
      >
        <RulesEditor config={config} setConfig={setConfig} data={data} disabled={disabled} />
      </Block>
    </fieldset>
  )
}
