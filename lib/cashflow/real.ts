import { addMonth, argentinaDate, expenseBucket, laborCost, roundCash } from "./model"
import { normalizeConcept, validateConfig } from "./config"
import type { Bucket, Config, Dataset } from "./types"

export type SectionKey = "sales" | Bucket
export const SECTION_LABELS: Record<SectionKey, string> = {
  sales: "Ventas de servicios",
  other_income: "Otros ingresos",
  capital: "Aportes de socios / financiación",
  worker: "Personal · honorarios y comisiones",
  materials: "Productos e insumos",
  fees: "Comisiones de cobro",
  fixed: "Gastos fijos",
  operating: "Otros gastos operativos",
  investment: "Inversiones",
  withdrawal: "Retiros de socios",
}
export const INCOME_SECTIONS: SectionKey[] = ["sales", "other_income", "capital"]
export const EXPENSE_SECTIONS: SectionKey[] = [
  "worker",
  "materials",
  "fees",
  "fixed",
  "operating",
  "investment",
  "withdrawal",
]
const OPERATING_INCOME = new Set<SectionKey>(["sales", "other_income"])
const OPERATING_EXPENSE = new Set<SectionKey>(["worker", "materials", "fees", "fixed", "operating"])

export type MonthInfo = { month: string; source: "real" | "partial" | "forecast" }
type Values = Record<string, number>
export type FlowLine = {
  key: string
  label: string
  values: Values
  projected: Record<string, boolean>
  total: number
  children: { label: string; values: Values; total: number }[]
}
export type FlowSection = {
  key: SectionKey
  label: string
  direction: "income" | "expense"
  lines: FlowLine[]
  values: Values
  total: number
}
export type Movement = {
  id: string
  date: string
  month: string
  origin: "cobro" | "propina" | "gasto" | "ingreso" | "inversion" | "ajuste"
  section: SectionKey
  direction: "income" | "expense"
  concept: string
  subconcept: string
  detail: string
  amount: number
  excluded: boolean
  ledger: boolean
}
export type MonthTotals = {
  income: number
  expense: number
  operatingIncome: number
  operatingExpense: number
  operatingNet: number
  capital: number
  investment: number
  withdrawals: number
  net: number
  cumulative: number
  recovered: number
}
export type LaborMonth = { month: string; estimated: boolean; sales: number } & ReturnType<typeof laborCost>
export type RealFlow = {
  labor: LaborMonth[]
  months: MonthInfo[]
  sections: FlowSection[]
  totals: Record<string, MonthTotals>
  movements: Movement[]
  investmentTotal: number
  recovered: number
  period: MonthTotals
  firstDate: string | null
  daysElapsed: number
  daily: { income: number; expense: number; operatingNet: number }
  monthly: { income: number; expense: number; operatingNet: number }
  paybackMonths: number | null
  paybackMonth: string | null
  breakEvenMonth: string | null
  today: string
}

const directionOf = (section: SectionKey) => (INCOME_SECTIONS.includes(section) ? "income" : "expense")
const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
const dayDistance = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
const AVERAGE_MONTH_DAYS = 30.44

function amount(value: number | string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw Error("Hay un importe inválido en los movimientos.")
  return roundCash(n)
}

/** Real ledger first; recurring and averaged lines only fill months after today. */
export function buildRealFlow(input: Config, data: Dataset, today: string): RealFlow {
  const config = validateConfig(input)
  const setup = config.actual
  const currentMonth = today.slice(0, 7)
  const excluded = new Set(setup.excluded)
  const movements: Movement[] = []
  const demo = new Set(data.demoClientIds)
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
  const push = (row: Omit<Movement, "month" | "excluded" | "direction">) => {
    if (row.ledger && row.date > today) return
    movements.push({
      ...row,
      month: row.date.slice(0, 7),
      direction: directionOf(row.section),
      excluded: excluded.has(row.id),
    })
  }
  for (const p of data.payments) {
    if (
      p.voided_at ||
      (p.appointment_id && demoAppointments.has(p.appointment_id)) ||
      (p.service_id && demoServices.has(p.service_id))
    )
      continue
    const tip = p.kind === "propina"
    push({
      id: p.id,
      date: argentinaDate(p.paid_at),
      origin: tip ? "propina" : "cobro",
      section: "sales",
      concept: tip ? "Propinas" : "Cobros de servicios",
      subconcept: p.method ? p.method.charAt(0).toUpperCase() + p.method.slice(1) : "",
      detail: "",
      amount: amount(p.amount),
      ledger: true,
    })
  }
  for (const i of data.incomes) {
    if (i.is_demo) continue
    const capital = config.rules.some(
      (r) => r.direction === "income" && r.bucket === "capital" && normalizeConcept(r.value) === normalizeConcept(i.concept),
    )
    push({
      id: i.id,
      date: argentinaDate(i.received_on),
      origin: "ingreso",
      section: capital ? "capital" : "other_income",
      concept: i.concept,
      subconcept: i.subconcept ?? "",
      detail: i.notes ?? "",
      amount: amount(i.amount),
      ledger: true,
    })
  }
  for (const e of data.expenses) {
    if (e.voided_at || e.is_demo) continue
    const bucket = expenseBucket(e, config)
    push({
      id: e.id,
      date: argentinaDate(e.spent_on),
      origin: "gasto",
      section: bucket === "capital" || bucket === "other_income" ? "operating" : bucket,
      concept: e.description?.trim() || e.category,
      subconcept: e.subconcept ?? "",
      detail: e.notes ?? "",
      amount: amount(e.amount),
      ledger: true,
    })
  }
  for (const inv of setup.investments)
    push({
      id: inv.id,
      date: inv.date,
      origin: "inversion",
      section: "investment",
      concept: inv.label,
      subconcept: inv.paidBy ? `Aportó ${inv.paidBy}` : "",
      detail: inv.note,
      amount: roundCash(inv.amount),
      ledger: false,
    })
  for (const adj of setup.adjustments)
    push({
      id: adj.id,
      date: `${adj.month}-01`,
      origin: "ajuste",
      section: adj.bucket,
      concept: adj.label,
      subconcept: "Ajuste manual",
      detail: adj.note,
      amount: roundCash(adj.amount),
      ledger: false,
    })
  movements.sort((a, b) => (a.date === b.date ? a.concept.localeCompare(b.concept) : a.date < b.date ? -1 : 1))

  const active = movements.filter((m) => !m.excluded)
  const ledgerDates = active.filter((m) => m.ledger).map((m) => m.date)
  const firstLedger = ledgerDates.length ? ledgerDates.reduce((a, b) => (a < b ? a : b)) : null
  const earliestMonth = active.length ? active.reduce((a, m) => (m.month < a ? m.month : a), active[0].month) : null
  let first = setup.startMonth ?? earliestMonth ?? currentMonth
  if (earliestMonth && earliestMonth < first) first = earliestMonth
  if (first > currentMonth) first = currentMonth
  const last = addMonth(currentMonth, setup.horizon)
  const months: MonthInfo[] = []
  for (let m = first; m <= last && months.length < 240; m = addMonth(m, 1))
    months.push({ month: m, source: m < currentMonth ? "real" : m === currentMonth ? "partial" : "forecast" })

  const lines = new Map<string, FlowLine & { section: SectionKey; childMap: Map<string, FlowLine["children"][number]> }>()
  const lineFor = (section: SectionKey, concept: string) => {
    const key = `${section}|${normalizeConcept(concept)}`
    let line = lines.get(key)
    if (!line) {
      line = { key, label: concept, section, values: {}, projected: {}, total: 0, children: [], childMap: new Map() }
      lines.set(key, line)
    }
    return line
  }
  for (const m of active) {
    const line = lineFor(m.section, m.concept)
    line.values[m.month] = roundCash((line.values[m.month] ?? 0) + m.amount)
    const childLabel = m.subconcept || "Sin subconcepto"
    const childKey = normalizeConcept(childLabel)
    let child = line.childMap.get(childKey)
    if (!child) {
      child = { label: childLabel, values: {}, total: 0 }
      line.childMap.set(childKey, child)
    }
    child.values[m.month] = roundCash((child.values[m.month] ?? 0) + m.amount)
  }

  const startDate = setup.startMonth && firstLedger && `${setup.startMonth}-01` < firstLedger ? `${setup.startMonth}-01` : firstLedger
  const daysElapsed = startDate && startDate <= today ? dayDistance(startDate, today) + 1 : 0
  const futureMonths = months.filter((m) => m.source === "forecast").map((m) => m.month)
  const recurringKeys = new Map<string, Set<string>>()
  for (const r of setup.recurring) {
    const section: SectionKey = r.bucket
    const line = lineFor(section, r.label)
    for (const month of futureMonths) {
      if (month < r.startMonth || (r.endMonth && month > r.endMonth)) continue
      line.values[month] = roundCash((line.values[month] ?? 0) + r.amount)
      line.projected[month] = true
      if (!recurringKeys.has(line.key)) recurringKeys.set(line.key, new Set())
      recurringKeys.get(line.key)!.add(month)
    }
  }
  if (setup.autoProject && daysElapsed > 0)
    for (const line of lines.values()) {
      if (!OPERATING_INCOME.has(line.section) && !OPERATING_EXPENSE.has(line.section)) continue
      const realTotal = active
        .filter((m) => m.ledger && m.month <= currentMonth && lineFor(m.section, m.concept) === line)
        .reduce((s, m) => s + m.amount, 0)
      if (!realTotal) continue
      const rate = realTotal / daysElapsed
      for (const month of futureMonths) {
        if (recurringKeys.get(line.key)?.has(month)) continue
        line.values[month] = roundCash(rate * daysInMonth(month))
        line.projected[month] = true
      }
    }

  // Labor is a percentage of sales plus the guaranteed-minimum top-up, so it replaces the averaged labor projection.
  const salesFor = (month: string) =>
    roundCash([...lines.values()].filter((l) => l.section === "sales").reduce((s, l) => s + (l.values[month] ?? 0), 0))
  const addChild = (line: ReturnType<typeof lineFor>, label: string, month: string, value: number) => {
    const key = normalizeConcept(label)
    let child = line.childMap.get(key)
    if (!child) {
      child = { label, values: {}, total: 0 }
      line.childMap.set(key, child)
    }
    child.values[month] = roundCash((child.values[month] ?? 0) + value)
  }
  const employeeLine = (name: string) => {
    const target = normalizeConcept(name)
    return (
      [...lines.values()].find((l) => l.section === "worker" && target.includes(normalizeConcept(l.label))) ??
      lineFor("worker", name.replace(/^empleado\s*\d+\s*·\s*/i, "").trim() || name)
    )
  }
  const labor: LaborMonth[] = []
  if (config.employees.length) {
    for (const line of lines.values())
      if (line.section === "worker")
        for (const month of futureMonths)
          if (line.projected[month] && !recurringKeys.get(line.key)?.has(month)) {
            delete line.values[month]
            delete line.projected[month]
          }
    const ledgerSales = active.filter((m) => m.ledger && m.section === "sales").reduce((s, m) => s + m.amount, 0)
    const remainingDays = daysInMonth(currentMonth) - Number(today.slice(8, 10))
    const currentSales = roundCash(
      salesFor(currentMonth) + (daysElapsed ? (ledgerSales / daysElapsed) * remainingDays : 0),
    )
    labor.push({ month: currentMonth, estimated: true, sales: currentSales, ...laborCost(config, currentSales, currentMonth) })
    for (const month of futureMonths) {
      const sales = salesFor(month)
      const cost = laborCost(config, sales, month)
      labor.push({ month, estimated: false, sales, ...cost })
      config.employees.forEach((employee, i) => {
        const e = cost.employees[i]
        if (!e.commission && !e.complement) return
        const line = employeeLine(employee.name)
        line.values[month] = roundCash((line.values[month] ?? 0) + e.commission + e.complement)
        line.projected[month] = true
        addChild(line, `Comisión ${e.percent.toLocaleString("es-AR")}% (proyectada)`, month, e.commission)
        if (e.complement) addChild(line, "Complemento mínimo garantizado (proyectado)", month, e.complement)
      })
    }
  }

  const sections: FlowSection[] = [...INCOME_SECTIONS, ...EXPENSE_SECTIONS].map((key) => {
    const sectionLines = [...lines.values()]
      .filter((l) => l.section === key)
      .map((l) => {
        const children = [...l.childMap.values()].map((c) => ({
          ...c,
          total: roundCash(Object.values(c.values).reduce((s, v) => s + v, 0)),
        }))
        const { childMap: _childMap, section: _section, ...rest } = l
        return {
          ...rest,
          total: roundCash(months.reduce((s, m) => s + (l.values[m.month] ?? 0), 0)),
          children: children.length > 1 || (children[0] && children[0].label !== "Sin subconcepto") ? children : [],
        }
      })
      .sort((a, b) => b.total - a.total)
    const values: Values = {}
    for (const m of months)
      values[m.month] = roundCash(sectionLines.reduce((s, l) => s + (l.values[m.month] ?? 0), 0))
    return {
      key,
      label: SECTION_LABELS[key],
      direction: directionOf(key),
      lines: sectionLines,
      values,
      total: roundCash(Object.values(values).reduce((s, v) => s + v, 0)),
    }
  })
  const bySection = Object.fromEntries(sections.map((s) => [s.key, s])) as Record<SectionKey, FlowSection>
  const sum = (keys: Iterable<SectionKey>, month: string) =>
    roundCash([...keys].reduce((s, k) => s + (bySection[k].values[month] ?? 0), 0))
  const totals: Record<string, MonthTotals> = {}
  let cumulative = setup.openingCash,
    recovered = 0,
    breakEvenMonth: string | null = null,
    wasNegative = false
  const period = emptyTotals()
  for (const { month, source } of months) {
    const t = emptyTotals()
    t.income = sum(INCOME_SECTIONS, month)
    t.expense = sum(EXPENSE_SECTIONS, month)
    t.operatingIncome = sum(OPERATING_INCOME, month)
    t.operatingExpense = sum(OPERATING_EXPENSE, month)
    t.operatingNet = roundCash(t.operatingIncome - t.operatingExpense)
    t.capital = bySection.capital.values[month] ?? 0
    t.investment = bySection.investment.values[month] ?? 0
    t.withdrawals = bySection.withdrawal.values[month] ?? 0
    t.net = roundCash(t.income - t.expense)
    cumulative = roundCash(cumulative + t.net)
    recovered = roundCash(recovered + t.operatingNet)
    t.cumulative = cumulative
    t.recovered = recovered
    if (cumulative < 0) wasNegative = true
    else if (wasNegative && !breakEvenMonth) breakEvenMonth = month
    totals[month] = t
    if (source !== "forecast")
      for (const key of Object.keys(period) as (keyof MonthTotals)[])
        if (key !== "cumulative" && key !== "recovered") period[key] = roundCash(period[key] + t[key])
  }
  period.cumulative = totals[currentMonth]?.cumulative ?? setup.openingCash
  period.recovered = period.operatingNet
  const investmentTotal = roundCash(
    active.filter((m) => m.section === "investment").reduce((s, m) => s + m.amount, 0),
  )
  const perDay = (v: number) => (daysElapsed ? v / daysElapsed : 0)
  const daily = {
    income: roundCash(perDay(period.operatingIncome)),
    expense: roundCash(perDay(period.operatingExpense)),
    operatingNet: roundCash(perDay(period.operatingNet)),
  }
  const monthly = {
    income: roundCash(daily.income * AVERAGE_MONTH_DAYS),
    expense: roundCash(daily.expense * AVERAGE_MONTH_DAYS),
    operatingNet: roundCash(daily.operatingNet * AVERAGE_MONTH_DAYS),
  }
  const remaining = investmentTotal - period.operatingNet
  const paybackMonths =
    investmentTotal <= 0 ? null : remaining <= 0 ? 0 : monthly.operatingNet > 0 ? remaining / monthly.operatingNet : null
  let paybackMonth: string | null = null
  if (paybackMonths !== null) {
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + Math.round(paybackMonths * AVERAGE_MONTH_DAYS))
    paybackMonth = date.toISOString().slice(0, 7)
  }
  return {
    labor,
    months,
    sections,
    totals,
    movements,
    investmentTotal,
    recovered: period.operatingNet,
    period,
    firstDate: startDate,
    daysElapsed,
    daily,
    monthly,
    paybackMonths,
    paybackMonth,
    breakEvenMonth,
    today,
  }
}

function emptyTotals(): MonthTotals {
  return {
    income: 0,
    expense: 0,
    operatingIncome: 0,
    operatingExpense: 0,
    operatingNet: 0,
    capital: 0,
    investment: 0,
    withdrawals: 0,
    net: 0,
    cumulative: 0,
    recovered: 0,
  }
}
