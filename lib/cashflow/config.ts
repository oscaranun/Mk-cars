import type { ActualSetup, Adjustment, Bucket, Config, RealInvestment, RecurringLine } from "./types"

export const BUCKET_LABELS: Record<Bucket, string> = {
  materials: "Productos y consumibles",
  worker: "Comisiones / honorarios de operarios",
  fees: "Comisiones de cobro",
  fixed: "Gastos fijos",
  operating: "Otros gastos operativos",
  investment: "Inversión / activos",
  withdrawal: "Retiros de socios",
  capital: "Aportes / financiación",
  other_income: "Otros ingresos operativos",
}
export const normalizeConcept = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

export const EXPENSE_BUCKETS: Bucket[] = ["worker", "materials", "fees", "fixed", "operating", "investment", "withdrawal"]
export const INCOME_BUCKETS: Bucket[] = ["other_income", "capital"]
export const DEFAULT_EMPLOYEES: Config["employees"] = [
  { id: "employee-1", name: "Empleado 1 · Rodrigo Aguilera", percent: 15 },
  { id: "employee-2", name: "Empleado 2 · Cristian Antúnez", percent: 15 },
]
export const defaultActual = (): ActualSetup => ({
  startMonth: null,
  openingCash: 0,
  investments: [],
  recurring: [],
  adjustments: [],
  excluded: [],
  horizon: 6,
  autoProject: true,
})
const MONTH = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/
const DAY = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function validateActual(
  a: ActualSetup,
  number: (value: unknown, label: string, min?: number, max?: number) => void,
  text: (value: unknown, label: string, max?: number) => void,
  list: (value: unknown, label: string, max?: number) => unknown[],
) {
  if (!a || typeof a !== "object" || Array.isArray(a)) throw Error("Revisá el flujo real.")
  if (a.startMonth !== null && (typeof a.startMonth !== "string" || !MONTH.test(a.startMonth)))
    throw Error("Revisá el mes de inicio real.")
  number(a.openingCash, "el saldo inicial real", -1e12)
  number(a.horizon, "los meses a proyectar", 0, 24)
  if (!Number.isInteger(a.horizon)) throw Error("Los meses a proyectar deben ser enteros.")
  if (typeof a.autoProject !== "boolean") throw Error("Revisá la proyección automática.")
  const ids = new Set<string>()
  const identity = (row: { id?: unknown; label?: unknown }, label: string) => {
    if (!row || typeof row !== "object") throw Error(`Revisá ${label}.`)
    text(row.id, "el identificador", 80)
    text(row.label, label)
    if (!row.id || !(row.label as string).trim() || ids.has(row.id as string))
      throw Error(`Cada fila de ${label} necesita un nombre.`)
    ids.add(row.id as string)
  }
  for (const row of list(a.investments, "la inversión real", 300) as RealInvestment[]) {
    identity(row, "la inversión real")
    number(row.amount, "el importe de la inversión real")
    if (typeof row.date !== "string" || !DAY.test(row.date)) throw Error(`Revisá la fecha de “${row.label}”.`)
    text(row.paidBy, "quién aportó")
    text(row.note, "la nota", 2000)
  }
  for (const row of list(a.recurring, "los recurrentes", 300) as RecurringLine[]) {
    identity(row, "los recurrentes")
    if (!(row.bucket in BUCKET_LABELS)) throw Error("Revisá la sección del recurrente.")
    number(row.amount, "el importe recurrente")
    if (typeof row.startMonth !== "string" || !MONTH.test(row.startMonth))
      throw Error(`Revisá el mes inicial de “${row.label}”.`)
    if (row.endMonth !== null && (typeof row.endMonth !== "string" || !MONTH.test(row.endMonth) || row.endMonth < row.startMonth))
      throw Error(`Revisá el mes final de “${row.label}”.`)
    text(row.note, "la nota", 2000)
  }
  for (const row of list(a.adjustments, "los ajustes", 500) as Adjustment[]) {
    identity(row, "los ajustes")
    if (!(row.bucket in BUCKET_LABELS)) throw Error("Revisá la sección del ajuste.")
    number(row.amount, "el importe del ajuste")
    if (typeof row.month !== "string" || !MONTH.test(row.month)) throw Error(`Revisá el mes de “${row.label}”.`)
    text(row.note, "la nota", 2000)
  }
  const excluded = list(a.excluded, "los movimientos excluidos", 5000)
  if (excluded.some((id) => typeof id !== "string" || id.length > 80) || new Set(excluded).size !== excluded.length)
    throw Error("Revisá los movimientos excluidos.")
}

/** Validate on both save and load; a malformed configuration must never produce a financial total. */
export function validateConfig(input: unknown): Config {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("La configuración no es válida.")
  const c = structuredClone(input) as Config
  const number = (value: unknown, label: string, min = 0, max = 1_000_000_000_000) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
      throw Error(`Revisá ${label}.`)
  }
  const text = (value: unknown, label: string, max = 200) => {
    if (typeof value !== "string" || value.length > max) throw Error(`Revisá ${label}.`)
  }
  const list = (value: unknown, label: string, max = 200) => {
    if (!Array.isArray(value) || value.length > max) throw Error(`Revisá ${label}.`)
    return value
  }
  if (c.schemaVersion !== 1) throw Error("Versión de configuración no compatible.")
  if (c.employees === undefined) c.employees = structuredClone(DEFAULT_EMPLOYEES)
  if (c.actual === undefined) c.actual = defaultActual()
  const employeeIds = new Set<string>()
  let employeeTotal = 0
  for (const row of list(c.employees, "los empleados", 20)) {
    if (!row || typeof row !== "object") throw Error("Revisá los empleados.")
    text(row.id, "el identificador", 80)
    text(row.name, "el nombre del empleado", 120)
    if (!row.id || !row.name.trim() || employeeIds.has(row.id)) throw Error("Cada empleado necesita un nombre.")
    employeeIds.add(row.id)
    number(row.percent, "la comisión del empleado", 0, 100)
    employeeTotal += row.percent
  }
  // The legacy single percentage stays in sync so older readers project the same labor cost.
  c.workerPercent = Math.round(employeeTotal * 10000) / 10000
  validateActual(c.actual, number, text, list)
  if (!["objective", "conservative", "moderate"].includes(c.scenario)) throw Error("Elegí un escenario válido.")
  if (c.startMonth !== null && !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(c.startMonth))
    throw Error("Revisá el mes inicial.")
  number(c.openingCash, "el saldo inicial", -1e12)
  for (const key of ["operatingDays", "firstMonthOperatingDays"] as const) {
    number(c[key], "los días operativos", 1, 31)
    if (!Number.isInteger(c[key])) throw Error("Los días operativos deben ser enteros.")
  }
  for (const key of ["vehiclesPerDay", "capacityPerDay", "conservativePerDay", "moderatePerDay"] as const)
    number(c[key], "los lavados diarios", 0, 100)
  number(c.ticket, "el ticket promedio", 0, 1e9)
  for (const key of ["workerPercent", "paymentPercent", "distributionPercent"] as const)
    number(c[key], "los porcentajes", 0, 100)
  if (c.workerPercent + c.paymentPercent > 100) throw Error("Las comisiones proyectadas no pueden superar el 100%.")
  for (const key of ["incomeInflation", "costInflation"] as const) number(c[key], "la inflación mensual", -50, 50)
  number(c.volumeGrowth, "el crecimiento mensual", -50, 100)
  for (const key of ["fixedCosts", "consumables", "investments"] as const) {
    const ids = new Set<string>()
    for (const row of list(c[key], key)) {
      if (!row || typeof row !== "object") throw Error("Fila de costos inválida.")
      text(row.id, "el identificador", 80)
      text(row.label, "el concepto")
      if (!row.id || !row.label.trim() || ids.has(row.id))
        throw Error("Los conceptos necesitan un nombre e identificador únicos.")
      ids.add(row.id)
      if (row.amount !== null) number(row.amount, "el importe del concepto")
    }
  }
  const expenseIds = new Set<string>()
  for (const row of c.investments) {
    text(row.kind, "el tipo de inversión")
    text(row.note, "la nota", 2000)
    text(row.paidBy, "quién aportó")
    if (row.expenseId !== null) {
      if (
        typeof row.expenseId !== "string" ||
        !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(row.expenseId) ||
        expenseIds.has(row.expenseId)
      )
        throw Error("Un gasto solo puede vincularse a una inversión.")
      expenseIds.add(row.expenseId)
    }
    if (typeof row.depreciate !== "boolean") throw Error("Revisá la amortización.")
    number(row.lifeMonths, "la vida útil", row.depreciate ? 1 : 0, 1200)
    number(row.residual, "el valor residual")
  }
  for (const row of list(c.inventory, "el inventario")) {
    text(row.id, "el identificador", 80)
    text(row.label, "el producto")
    number(row.quantity, "la cantidad", 0, 1e6)
    number(row.unitPrice, "el precio del inventario")
  }
  let shares = 0
  for (const row of list(c.partners, "los socios", 20)) {
    text(row.name, "el socio")
    number(row.percent, "la participación", 0, 100)
    shares += row.percent
  }
  if (Math.abs(shares - 100) > 0.0001) throw Error("Las participaciones de los socios deben sumar 100%.")
  const ruleKeys = new Set<string>()
  for (const rule of list(c.rules, "la clasificación de movimientos", 500)) {
    text(rule.value, "el concepto para clasificar")
    if (!["expense", "income"].includes(rule.direction) || !rule.value.trim() || !(rule.bucket in BUCKET_LABELS))
      throw Error("Clasificación inválida.")
    const allowed =
      rule.direction === "income"
        ? ["capital", "other_income"]
        : ["materials", "worker", "fees", "fixed", "operating", "investment", "withdrawal"]
    if (!allowed.includes(rule.bucket)) throw Error("La clasificación no corresponde al tipo de movimiento.")
    const key = `${rule.direction}:${normalizeConcept(rule.value)}`
    if (ruleKeys.has(key)) throw Error("Hay conceptos repetidos en la clasificación.")
    ruleKeys.add(key)
  }
  return c
}
