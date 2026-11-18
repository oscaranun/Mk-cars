"use client"

import { useId, type Dispatch, type SetStateAction } from "react"
import type { Config, Dataset, CostLine } from "@/lib/cashflow/types"
import { BUCKET_LABELS } from "@/lib/cashflow/config"
import { fieldClass, secondaryButtonClass } from "@/components/admin/ui"

type Props = { config: Config; setConfig: Dispatch<SetStateAction<Config>>; data: Dataset; disabled: boolean }
export function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max = 1e12,
  step = "0.01",
}: {
  label: string
  value: number | null
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: string
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value !== null && Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className={fieldClass}
      />
    </label>
  )
}
function Text({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input id={id} value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </label>
  )
}
export function CashflowSettings({ config, setConfig, data, disabled }: Props) {
  const set = <K extends keyof Config>(key: K, value: Config[K]) => setConfig((c) => ({ ...c, [key]: value }))
  const patchInvestment = (index: number, patch: Partial<Config["investments"][number]>) =>
    set(
      "investments",
      config.investments.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  const costs = (key: "fixedCosts" | "consumables", title: string) => (
    <details className="rounded-2xl border border-border p-4">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-4 space-y-3">
        {config[key].map((row, index) => (
          <div key={row.id} className="grid items-end gap-2 sm:grid-cols-[1fr_160px_auto]">
            <Text
              label="Concepto"
              value={row.label}
              onChange={(label) =>
                set(
                  key,
                  config[key].map((r, i) => (i === index ? { ...r, label } : r)),
                )
              }
            />
            <Numeric
              label={key === "fixedCosts" ? "Importe mensual" : "Costo por lavado"}
              value={row.amount}
              onChange={(amount) =>
                set(
                  key,
                  config[key].map((r, i) =>
                    i === index ? { ...r, amount: Number.isFinite(amount) ? amount : null } : r,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() =>
                set(
                  key,
                  config[key].filter((_, i) => i !== index),
                )
              }
              className={secondaryButtonClass}
              aria-label={`Quitar ${row.label}`}
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => set(key, [...config[key], { id: crypto.randomUUID(), label: "Nuevo concepto", amount: 0 }])}
        >
          Agregar concepto
        </button>
      </div>
    </details>
  )
  const numericFields: [
    keyof Pick<
      Config,
      | "openingCash"
      | "operatingDays"
      | "firstMonthOperatingDays"
      | "vehiclesPerDay"
      | "capacityPerDay"
      | "ticket"
      | "workerPercent"
      | "paymentPercent"
      | "incomeInflation"
      | "costInflation"
      | "volumeGrowth"
      | "distributionPercent"
      | "conservativePerDay"
      | "moderatePerDay"
    >,
    string,
    number,
    number,
  ][] = [
    ["openingCash", "Saldo previo al primer movimiento", -1e12, 1e12],
    ["operatingDays", "Días operativos por mes", 1, 31],
    ["firstMonthOperatingDays", "Días operativos del primer mes", 1, 31],
    ["vehiclesPerDay", "Lavados por día · objetivo", 0, 100],
    ["conservativePerDay", "Lavados por día · conservador", 0, 100],
    ["moderatePerDay", "Lavados por día · moderado", 0, 100],
    ["capacityPerDay", "Capacidad máxima por día", 0, 100],
    ["ticket", "Ticket promedio proyectado", 0, 1e9],
    ["workerPercent", "Comisión operarios proyectada (%)", 0, 100],
    ["paymentPercent", "Comisión de cobro proyectada (%)", 0, 100],
    ["incomeInflation", "Inflación mensual de ingresos (%)", -50, 50],
    ["costInflation", "Inflación mensual de costos (%)", -50, 50],
    ["volumeGrowth", "Crecimiento mensual de lavados (%)", -50, 100],
    ["distributionPercent", "Distribución de caja proyectada a socios (%)", 0, 100],
  ]
  const expenses = data.expenses.filter((e) => !e.voided_at && !e.is_demo)
  const investmentCaption = (row: Config["investments"][number]) => {
    const linked = expenses.find((e) => e.id === row.expenseId)
    const value = linked ? Number(linked.amount) : row.amount
    return value === null
      ? "Importe pendiente"
      : `${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value)} · ${linked ? "movimiento registrado" : "modelo"}`
  }
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4 disabled:opacity-70">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Mes inicial del modelo (vacío = primer movimiento)
          <input
            type="month"
            value={config.startMonth ?? ""}
            onChange={(e) => set("startMonth", e.target.value || null)}
            className={fieldClass}
          />
        </label>
        {numericFields.map(([key, label, min, max]) => (
          <Numeric
            key={key}
            label={label}
            min={min}
            max={max}
            value={config[key]}
            onChange={(value) => set(key, value)}
            step={key.includes("Days") ? "1" : "0.01"}
          />
        ))}
      </div>
      {costs("fixedCosts", "Gastos fijos proyectados")}
      {costs("consumables", "Productos y costos por lavado")}
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Inversión inicial y aportes</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          Los importes sin gasto asociado son supuestos del modelo. Vinculá el movimiento correspondiente para que esa
          salida no se descuente dos veces. Quitar una fila del modelo no borra gastos.
        </p>
        <div className="mt-4 space-y-3">
          {config.investments.map((row, index) => (
            <details key={row.id} className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {row.label} · {investmentCaption(row)}
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Text
                  label="Concepto de inversión"
                  value={row.label}
                  onChange={(label) => patchInvestment(index, { label })}
                />
                <Numeric
                  label="Importe de inversión (sin importe = pendiente)"
                  value={row.amount}
                  onChange={(amount) => patchInvestment(index, { amount: Number.isFinite(amount) ? amount : null })}
                />
                <Text
                  label="Pagó / aportó"
                  value={row.paidBy}
                  onChange={(paidBy) => patchInvestment(index, { paidBy })}
                />
                <Text
                  label="Tipo de inversión"
                  value={row.kind}
                  onChange={(kind) => patchInvestment(index, { kind })}
                />
                <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
                  Gasto ya registrado (opcional)
                  <select
                    value={row.expenseId ?? ""}
                    onChange={(e) => patchInvestment(index, { expenseId: e.target.value || null })}
                    className={fieldClass}
                  >
                    <option value="">Sin movimiento asociado · supuesto del modelo</option>
                    {expenses.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.spent_on} · {e.description || e.category} · ${Number(e.amount).toLocaleString("es-AR")}
                      </option>
                    ))}
                  </select>
                </label>
                {row.expenseId && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Se usa el importe del gasto vigente asociado. El importe editable queda como referencia y no se
                    descuenta otra vez.
                  </p>
                )}
                <Text
                  label="Nota / dato por confirmar"
                  value={row.note}
                  onChange={(note) => patchInvestment(index, { note })}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.depreciate}
                    onChange={(e) =>
                      patchInvestment(index, {
                        depreciate: e.target.checked,
                        lifeMonths: e.target.checked && row.lifeMonths === 0 ? 60 : row.lifeMonths,
                      })
                    }
                  />
                  Calcular amortización económica (no es caja)
                </label>
                <Numeric
                  label="Vida útil (meses)"
                  value={row.lifeMonths}
                  onChange={(lifeMonths) => patchInvestment(index, { lifeMonths })}
                  max={1200}
                  step="1"
                />
                <Numeric
                  label="Valor residual"
                  value={row.residual}
                  onChange={(residual) => patchInvestment(index, { residual })}
                />
                <button
                  type="button"
                  className={`${secondaryButtonClass} w-fit`}
                  onClick={() =>
                    set(
                      "investments",
                      config.investments.filter((_, i) => i !== index),
                    )
                  }
                >
                  Quitar del modelo
                </button>
              </div>
            </details>
          ))}
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() =>
              set("investments", [
                ...config.investments,
                {
                  id: crypto.randomUUID(),
                  label: "Nueva inversión",
                  amount: null,
                  kind: "Activo",
                  note: "",
                  paidBy: "",
                  expenseId: null,
                  depreciate: false,
                  lifeMonths: 0,
                  residual: 0,
                },
              ])
            }
          >
            Agregar inversión
          </button>
        </div>
      </details>
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Inventario de referencia</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          El inventario no se suma otra vez a la inversión ni se convierte en gasto histórico automáticamente.
        </p>
        <div className="mt-3 space-y-3">
          {config.inventory.map((row, index) => (
            <div key={row.id} className="grid gap-2 sm:grid-cols-3">
              <Text
                label="Producto"
                value={row.label}
                onChange={(label) =>
                  set(
                    "inventory",
                    config.inventory.map((r, i) => (i === index ? { ...r, label } : r)),
                  )
                }
              />
              <Numeric
                label="Cantidad"
                value={row.quantity}
                onChange={(quantity) =>
                  set(
                    "inventory",
                    config.inventory.map((r, i) => (i === index ? { ...r, quantity } : r)),
                  )
                }
              />
              <Numeric
                label="Precio unitario"
                value={row.unitPrice}
                onChange={(unitPrice) =>
                  set(
                    "inventory",
                    config.inventory.map((r, i) => (i === index ? { ...r, unitPrice } : r)),
                  )
                }
              />
            </div>
          ))}
        </div>
      </details>
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Socios y participación ilustrativa</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          Los porcentajes solo distribuyen retiros futuros del modelo. Los retiros reales se toman de los gastos
          clasificados y no se crean automáticamente.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {config.partners.map((row, index) => (
            <div key={index} className="grid grid-cols-2 gap-2">
              <Text
                label="Socio"
                value={row.name}
                onChange={(name) =>
                  set(
                    "partners",
                    config.partners.map((r, i) => (i === index ? { ...r, name } : r)),
                  )
                }
              />
              <Numeric
                label="Participación (%)"
                value={row.percent}
                onChange={(percent) =>
                  set(
                    "partners",
                    config.partners.map((r, i) => (i === index ? { ...r, percent } : r)),
                  )
                }
                max={100}
              />
            </div>
          ))}
        </div>
      </details>
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Clasificar comisiones, gastos y aportes reales</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          La coincidencia es por concepto exacto, ignorando mayúsculas y tildes. Se busca primero la descripción y
          después la categoría. Lo no clasificado sigue contado en caja como otro gasto operativo.
        </p>
        <datalist id="cashflow-concepts">
          {[
            ...new Set([
              ...data.expenses.map((e) => e.description || e.category),
              ...data.incomes.map((i) => i.concept),
            ]),
          ].map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <div className="mt-3 space-y-3">
          {config.rules.map((rule, index) => (
            <div key={index} className="grid items-end gap-2 sm:grid-cols-[100px_1fr_1fr_auto]">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Tipo
                <select
                  value={rule.direction}
                  onChange={(e) =>
                    set(
                      "rules",
                      config.rules.map((r, i) =>
                        i === index
                          ? {
                              ...r,
                              direction: e.target.value as "expense" | "income",
                              bucket: e.target.value === "income" ? "other_income" : "operating",
                            }
                          : r,
                      ),
                    )
                  }
                  className={fieldClass}
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Concepto exacto
                <input
                  list="cashflow-concepts"
                  value={rule.value}
                  maxLength={200}
                  onChange={(e) =>
                    set(
                      "rules",
                      config.rules.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)),
                    )
                  }
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Clasificación
                <select
                  value={rule.bucket}
                  onChange={(e) =>
                    set(
                      "rules",
                      config.rules.map((r, i) =>
                        i === index ? { ...r, bucket: e.target.value as typeof r.bucket } : r,
                      ),
                    )
                  }
                  className={fieldClass}
                >
                  {Object.entries(BUCKET_LABELS)
                    .filter(([key]) =>
                      rule.direction === "income"
                        ? ["capital", "other_income"].includes(key)
                        : !["capital", "other_income"].includes(key),
                    )
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  set(
                    "rules",
                    config.rules.filter((_, i) => i !== index),
                  )
                }
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() =>
              set("rules", [...config.rules, { direction: "expense", value: "Nuevo concepto", bucket: "operating" }])
            }
          >
            Agregar clasificación
          </button>
        </div>
      </details>
    </fieldset>
  )
}
