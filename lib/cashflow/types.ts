export type Bucket =
  | "materials"
  | "worker"
  | "fees"
  | "fixed"
  | "operating"
  | "investment"
  | "withdrawal"
  | "capital"
  | "other_income"
export type Rule = { direction: "expense" | "income"; value: string; bucket: Bucket }
export type CostLine = { id: string; label: string; amount: number | null }
export type Investment = CostLine & {
  kind: string
  note: string
  paidBy: string
  expenseId: string | null
  depreciate: boolean
  lifeMonths: number
  residual: number
}
export type Config = {
  schemaVersion: 1
  startMonth: string | null
  openingCash: number
  scenario: "objective" | "conservative" | "moderate"
  operatingDays: number
  firstMonthOperatingDays: number
  vehiclesPerDay: number
  capacityPerDay: number
  ticket: number
  workerPercent: number
  paymentPercent: number
  incomeInflation: number
  costInflation: number
  volumeGrowth: number
  distributionPercent: number
  conservativePerDay: number
  moderatePerDay: number
  partners: { name: string; percent: number }[]
  fixedCosts: CostLine[]
  consumables: CostLine[]
  investments: Investment[]
  inventory: { id: string; label: string; quantity: number; unitPrice: number }[]
  rules: Rule[]
  employees: Employee[]
  actual: ActualSetup
}
export type Employee = { id: string; name: string; percent: number }
export type RealInvestment = {
  id: string
  label: string
  amount: number
  date: string
  paidBy: string
  note: string
  estimated: boolean
}
/** Recurring and one-off lines use a bucket so they land in the same section as real movements. */
export type RecurringLine = {
  id: string
  label: string
  bucket: Bucket
  amount: number
  startMonth: string
  endMonth: string | null
  note: string
}
export type Adjustment = { id: string; month: string; label: string; bucket: Bucket; amount: number; note: string }
export type ActualSetup = {
  startMonth: string | null
  openingCash: number
  investments: RealInvestment[]
  recurring: RecurringLine[]
  adjustments: Adjustment[]
  excluded: string[]
  horizon: number
  autoProject: boolean
}
export type CashPayment = {
  id: string
  amount: number | string
  paid_at: string
  kind: string | null
  method: string
  voided_at: string | null
  service_id: string | null
  appointment_id: string | null
}
export type CashExpense = {
  id: string
  amount: number | string
  spent_on: string
  category: string
  description: string | null
  subconcept?: string | null
  notes?: string | null
  voided_at: string | null
  is_demo: boolean
}
export type CashIncome = {
  id: string
  amount: number | string
  received_on: string
  concept: string
  subconcept?: string | null
  notes?: string | null
  is_demo: boolean
}
export type CashService = {
  id: string
  appointment_id: string | null
  client_id: string | null
  performed_at: string
  final_price: number | string
}
export type CashAppointment = {
  id: string
  client_id: string | null
  status: string
  confirmed_start: string | null
  requested_start: string | null
  agreed_price: number | string | null
  adjusted_price: number | string | null
  discount: number | string | null
}
export type Dataset = {
  payments: CashPayment[]
  expenses: CashExpense[]
  incomes: CashIncome[]
  services: CashService[]
  appointments: CashAppointment[]
  vehicleLines: { appointment_id: string }[]
  demoClientIds: string[]
  warnings: string[]
}
export type Amounts = {
  washes: number
  jobs: number
  billed: number
  serviceReceipts: number
  tips: number
  otherIncome: number
  capital: number
  materials: number
  worker: number
  fees: number
  fixed: number
  operating: number
  investment: number
  withdrawals: number
  receipts: number
  expenses: number
  operatingNet: number
  net: number
  ticket: number | null
  workerRecorded: boolean
  feesRecorded: boolean
}
export type Month = {
  month: string
  source: "real" | "partial" | "forecast"
  actual: Amounts
  forecast: Amounts
  selected: Amounts
  baselineCumulative: number
  cumulative: number
  modeledCumulative: number
  modelInvestment: number
}
export type Report = {
  rows: Month[]
  earliestDate: string | null
  startMonth: string
  today: string
  warnings: string[]
  totals: Amounts
  investmentTotal: number
  unlinkedInvestment: number
  inventoryTotal: number
  depreciation: number
  baselineMonth: Amounts
  breakEvenWashes: number | null
  modelPaybackMonth: string | null
}
