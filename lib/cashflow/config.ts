import type { Config, Bucket } from "./types"

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
