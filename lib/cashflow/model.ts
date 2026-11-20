import type { Amounts, CashExpense, Config, Dataset, Month, Report } from "./types"
import { normalizeConcept, validateConfig } from "./config"

export const roundCash = (value: number) => {
  const cents = Math.round(value * 100)
  if (!Number.isSafeInteger(cents))
    throw Error("Los importes del modelo exceden el rango permitido. Revisá los supuestos.")
  return cents / 100
}
export function argentinaDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00Z`)
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
      throw Error("Hay una fecha inválida en los movimientos.")
    return value
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw Error("Hay una fecha inválida en los movimientos.")
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}
export function addMonth(month: string, offset: number) {
  const [y, m] = month.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}
function monthDistance(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number),
    [ty, tm] = to.split("-").map(Number)
  return (ty - fy) * 12 + tm - fm
}
export function emptyAmounts(): Amounts {
  return {
    washes: 0,
    jobs: 0,
    billed: 0,
    serviceReceipts: 0,
    tips: 0,
    otherIncome: 0,
    capital: 0,
    materials: 0,
    worker: 0,
    fees: 0,
    fixed: 0,
    operating: 0,
    investment: 0,
    withdrawals: 0,
    receipts: 0,
    expenses: 0,
    operatingNet: 0,
    net: 0,
    ticket: null,
    workerRecorded: false,
    feesRecorded: false,
  }
}
function finish(a: Amounts): Amounts {
  a.receipts = roundCash(a.serviceReceipts + a.tips + a.otherIncome + a.capital)
  a.expenses = roundCash(a.materials + a.worker + a.fees + a.fixed + a.operating + a.investment + a.withdrawals)
  a.operatingNet = roundCash(
    a.serviceReceipts + a.tips + a.otherIncome - a.materials - a.worker - a.fees - a.fixed - a.operating,
  )
  a.net = roundCash(a.receipts - a.expenses)
  a.ticket = a.washes ? roundCash(a.billed / a.washes) : null
  return a
}
function amount(value: number | string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0)
    throw Error("Hay un importe inválido en los movimientos. No se calculó un saldo parcial.")
  return roundCash(n)
}
export function expenseBucket(
  expense: Pick<CashExpense, "category" | "description" | "subconcept">,
  config: Config,
) {
  // The subconcept wins so "Rodrigo Aguilera · Combustible" counts as fuel, not as labor.
  return (
    (expense.subconcept
      ? config.rules.find(
          (r) => r.direction === "expense" && normalizeConcept(r.value) === normalizeConcept(expense.subconcept || ""),
        )?.bucket
      : undefined) ??
    config.rules.find(
      (r) => r.direction === "expense" && normalizeConcept(r.value) === normalizeConcept(expense.description || ""),
    )?.bucket ??
    config.rules.find(
      (r) => r.direction === "expense" && normalizeConcept(r.value) === normalizeConcept(expense.category),
    )?.bucket ??
    "operating"
  )
}
/** Each employee earns max(commission, guaranteed minimum) while the minimum is in force for that month. */
export function laborCost(config: Config, sales: number, month: string | null) {
  const employees = config.employees.map((e) => {
    const commission = roundCash((sales * e.percent) / 100)
    const guaranteed = month !== null && e.minimum > 0 && (!e.minimumUntil || month <= e.minimumUntil)
    const complement = guaranteed ? roundCash(Math.max(0, e.minimum - commission)) : 0
    return { id: e.id, name: e.name, percent: e.percent, minimum: guaranteed ? e.minimum : 0, commission, complement }
  })
  return {
    employees,
    commission: roundCash(employees.reduce((s, e) => s + e.commission, 0)),
    complement: roundCash(employees.reduce((s, e) => s + e.complement, 0)),
  }
}
export function projection(config: Config, index: number, month: string | null = null): Amounts {
  const a = emptyAmounts()
  if (index < 0 || index >= 24) return a
  const days = index === 0 ? config.firstMonthOperatingDays : config.operatingDays
  const daily =
    config.scenario === "conservative"
      ? config.conservativePerDay
      : config.scenario === "moderate"
        ? config.moderatePerDay
        : config.vehiclesPerDay
  a.washes =
    Math.round(Math.min(config.capacityPerDay, daily * (1 + config.volumeGrowth / 100) ** index) * days * 100) / 100
  a.jobs = a.washes
  const ticket = config.ticket * (1 + config.incomeInflation / 100) ** index
  a.billed = roundCash(a.washes * ticket)
  a.serviceReceipts = a.billed
  const labor = laborCost(config, a.billed, month)
  a.worker = config.employees.length
    ? roundCash(labor.commission + labor.complement)
    : roundCash((a.billed * config.workerPercent) / 100)
  a.fees = roundCash((a.billed * config.paymentPercent) / 100)
  a.materials = roundCash(
    a.washes * config.consumables.reduce((s, c) => s + (c.amount ?? 0), 0) * (1 + config.costInflation / 100) ** index,
  )
  a.fixed = roundCash(
    config.fixedCosts.reduce((s, c) => s + (c.amount ?? 0), 0) * (1 + config.costInflation / 100) ** index,
  )
  a.workerRecorded = false
  a.feesRecorded = false
  finish(a)
  a.withdrawals = roundCash((Math.max(0, a.operatingNet) * config.distributionPercent) / 100)
  return finish(a)
}

/** Actual cash is always ledger cash. Percentages and depreciation never manufacture historical expenses. */
export function buildCashflow(input: Config, data: Dataset, today: string): Report {
  const config = validateConfig(input)
  argentinaDate(today)
  const currentMonth = today.slice(0, 7)
  const warnings = [...data.warnings]
  const actuals = new Map<string, Amounts>()
  let earliestDate: string | null = null,
    futureCount = 0
  const at = (value: string) => {
    const day = argentinaDate(value)
    if (day > today) {
      futureCount++
      return null
    }
    if (!earliestDate || day < earliestDate) earliestDate = day
    const key = day.slice(0, 7)
    if (!actuals.has(key)) actuals.set(key, emptyAmounts())
    return actuals.get(key)!
  }
  const demo = new Set(data.demoClientIds)
  const appointments = new Map(data.appointments.map((a) => [a.id, a]))
  const demoAppointments = new Set(
    data.appointments.filter((a) => a.client_id && demo.has(a.client_id)).map((a) => a.id),
  )
  const demoServices = new Set(
    data.services
      .filter(
        (s) => (s.client_id && demo.has(s.client_id)) || (s.appointment_id && demoAppointments.has(s.appointment_id)),
      )
      .map((s) => s.id),
  )
  const lines = new Map<string, number>()
  for (const row of data.vehicleLines) lines.set(row.appointment_id, (lines.get(row.appointment_id) ?? 0) + 1)
  const done = new Set<string>(),
    servicesWithAppointment = new Set<string>()
  for (const service of data.services) {
    if (demoServices.has(service.id)) continue
    if (service.appointment_id) servicesWithAppointment.add(service.appointment_id)
    if (
      service.appointment_id &&
      ["cancelado", "rechazado"].includes(appointments.get(service.appointment_id)?.status ?? "")
    )
      continue
    const row = at(service.performed_at)
    if (!row) continue
    row.billed = roundCash(row.billed + amount(service.final_price))
    const id = service.appointment_id ?? service.id
    if (!done.has(id)) {
      row.washes += service.appointment_id ? Math.max(1, lines.get(service.appointment_id) ?? 1) : 1
      row.jobs++
      done.add(id)
    } else
      warnings.push("Hay más de un servicio asociado al mismo turno; revisá su facturación para descartar duplicados.")
  }
  for (const appointment of data.appointments) {
    if (
      appointment.status !== "realizado" ||
      servicesWithAppointment.has(appointment.id) ||
      demoAppointments.has(appointment.id)
    )
      continue
    const date = appointment.confirmed_start ?? appointment.requested_start
    if (!date) {
      warnings.push("Un trabajo realizado no tiene fecha y no se pudo asignar a un mes.")
      continue
    }
    const row = at(date)
    if (!row) continue
    row.washes += Math.max(1, lines.get(appointment.id) ?? 1)
    row.jobs++
    row.billed = roundCash(
      row.billed +
        amount(
          appointment.adjusted_price ??
            Math.max(0, Number(appointment.agreed_price ?? 0) - Number(appointment.discount ?? 0)),
        ),
    )
  }
  for (const payment of data.payments) {
    if (
      payment.voided_at ||
      (payment.appointment_id && demoAppointments.has(payment.appointment_id)) ||
      (payment.service_id && demoServices.has(payment.service_id))
    )
      continue
    const row = at(payment.paid_at)
    if (!row) continue
    const key = payment.kind === "propina" ? "tips" : "serviceReceipts"
    row[key] = roundCash(row[key] + amount(payment.amount))
  }
  for (const income of data.incomes) {
    if (income.is_demo) continue
    const row = at(income.received_on)
    if (!row) continue
    const rule = config.rules.find(
      (r) => r.direction === "income" && normalizeConcept(r.value) === normalizeConcept(income.concept),
    )
    const key = rule?.bucket === "capital" ? "capital" : "otherIncome"
    row[key] = roundCash(row[key] + amount(income.amount))
  }
  const expenseMap = new Map(
    data.expenses.filter((e) => !e.voided_at && !e.is_demo && argentinaDate(e.spent_on) <= today).map((e) => [e.id, e]),
  )
  const linkedExpenses = new Set(config.investments.map((i) => i.expenseId).filter((id): id is string => Boolean(id)))
  for (const expense of data.expenses) {
    if (expense.voided_at || expense.is_demo) continue
    const row = at(expense.spent_on)
    if (!row) continue
    const bucket = linkedExpenses.has(expense.id) ? "investment" : expenseBucket(expense, config)
    const key = (
      ["materials", "worker", "fees", "fixed", "operating", "investment", "withdrawal"].includes(bucket)
        ? bucket
        : "operating"
    ) as "operating"
    row[key] = roundCash(row[key] + amount(expense.amount))
    if (bucket === "worker") row.workerRecorded = true
    if (bucket === "fees") row.feesRecorded = true
  }
  let investmentTotal = 0,
    unlinkedInvestment = 0,
    depreciation = 0
  for (const item of config.investments) {
    const linked = item.expenseId ? expenseMap.get(item.expenseId) : undefined
    const value = linked ? amount(linked.amount) : (item.amount ?? 0)
    investmentTotal = roundCash(investmentTotal + value)
    if (!linked) unlinkedInvestment = roundCash(unlinkedInvestment + value)
    if (item.expenseId && !linked)
      warnings.push(
        `La inversión “${item.label}” no tiene un gasto vigente asociado; se mantiene como supuesto del modelo.`,
      )
    if (item.amount === null && !linked) warnings.push(`Falta cargar el importe de “${item.label}”.`)
    if (item.depreciate) depreciation += Math.max(0, value - item.residual) / item.lifeMonths
  }
  if ([...config.fixedCosts, ...config.consumables].some((c) => c.amount === null))
    warnings.push("Hay costos proyectados sin importe; completalos antes de evaluar el escenario.")
  const totals = emptyAmounts()
  for (const row of actuals.values()) {
    finish(row)
    for (const key of [
      "washes",
      "jobs",
      "billed",
      "serviceReceipts",
      "tips",
      "otherIncome",
      "capital",
      "materials",
      "worker",
      "fees",
      "fixed",
      "operating",
      "investment",
      "withdrawals",
    ] as const)
      totals[key] = roundCash(totals[key] + row[key])
    totals.workerRecorded ||= row.workerRecorded
    totals.feesRecorded ||= row.feesRecorded
  }
  finish(totals)
  if (totals.otherIncome > 0)
    warnings.push(
      "Los otros ingresos manuales se incluyen en la caja, pero no agregan lavados ni facturación por servicios: no tienen una cantidad de vehículos registrada. Para contar un lavado, cargá el trabajo realizado.",
    )
  if (totals.receipts > 0 && !totals.workerRecorded)
    warnings.push(
      "No hay comisiones / honorarios de operarios clasificados por separado. El porcentaje del modelo no se descuenta de la caja real.",
    )
  if (totals.receipts > 0 && !totals.feesRecorded)
    warnings.push(
      "No hay comisiones de cobro clasificadas por separado. No se supone que sean cero ni se inventan como gasto real.",
    )
  if (futureCount) warnings.push("Los registros con fecha posterior a hoy no se incluyeron como movimientos reales.")
  const startMonth = config.startMonth ?? (earliestDate ? String(earliestDate).slice(0, 7) : currentMonth)
  const first =
    earliestDate && String(earliestDate).slice(0, 7) < startMonth
      ? String(earliestDate).slice(0, 7)
      : startMonth < currentMonth
        ? startMonth
        : currentMonth
  const last = addMonth(startMonth, 23) > currentMonth ? addMonth(startMonth, 23) : currentMonth
  if (monthDistance(first, last) > 1200) throw Error("El período abarca más de 100 años; revisá las fechas cargadas.")
  if (addMonth(startMonth, 23) < currentMonth)
    warnings.push(
      "El horizonte de 24 meses terminó. El historial se conserva; podés cambiar el mes inicial para preparar un nuevo plan.",
    )
  const rows: Month[] = []
  let cumulative = config.openingCash,
    modeled = config.openingCash,
    baseline = config.openingCash
  let modelPaybackMonth: string | null = null,
    recovery = -investmentTotal
  for (let month = first; month <= last; month = addMonth(month, 1)) {
    const index = monthDistance(startMonth, month)
    const forecast = projection(config, index, month),
      actual = actuals.get(month) ?? emptyAmounts()
    const source = month < currentMonth ? "real" : month === currentMonth ? "partial" : "forecast"
    const selected = source === "forecast" ? forecast : actual
    const modelInvestment = month === startMonth ? unlinkedInvestment : 0
    cumulative = roundCash(cumulative + selected.net)
    modeled = roundCash(modeled + selected.net - modelInvestment)
    baseline = roundCash(baseline + forecast.net - (month === startMonth ? investmentTotal : 0))
    if (month >= startMonth) recovery = roundCash(recovery + selected.operatingNet - selected.withdrawals)
    if (!modelPaybackMonth && investmentTotal > 0 && month >= startMonth && recovery >= 0) modelPaybackMonth = month
    rows.push({
      month,
      source,
      actual,
      forecast,
      selected,
      cumulative,
      modeledCumulative: modeled,
      baselineCumulative: baseline,
      modelInvestment,
    })
  }
  const unitMargin =
    config.ticket * (1 - (config.workerPercent + config.paymentPercent) / 100) -
    config.consumables.reduce((s, c) => s + (c.amount ?? 0), 0)
  return {
    rows,
    earliestDate,
    startMonth,
    today,
    warnings: [...new Set(warnings)],
    totals,
    investmentTotal,
    unlinkedInvestment,
    inventoryTotal: roundCash(config.inventory.reduce((s, r) => s + r.quantity * r.unitPrice, 0)),
    depreciation: roundCash(depreciation),
    baselineMonth: projection(config, 0, startMonth),
    breakEvenWashes:
      unitMargin > 0 ? Math.ceil(config.fixedCosts.reduce((s, c) => s + (c.amount ?? 0), 0) / unitMargin) : null,
    modelPaybackMonth,
  }
}
