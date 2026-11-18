const { test, after } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path")
const ts = require("typescript")
const root = path.join(__dirname, ".."),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "mk-cashflow-"))
for (const name of ["types", "config", "model"])
  fs.writeFileSync(
    path.join(temp, name + ".js"),
    ts.transpileModule(fs.readFileSync(path.join(root, "lib/cashflow", name + ".ts"), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText,
  )
const { buildCashflow, projection, argentinaDate } = require(path.join(temp, "model.js"))
const { validateConfig } = require(path.join(temp, "config.js"))
const workbook = JSON.parse(
  fs.readFileSync(process.env.MK_CARS_MODEL_FILE || path.join(__dirname, "fixtures/cashflow-workbook.json"), "utf8"),
)
const defaults = () => structuredClone(workbook.config)
const empty = () => ({
  payments: [],
  expenses: [],
  incomes: [],
  services: [],
  appointments: [],
  vehicleLines: [],
  demoClientIds: [],
  warnings: [],
})
const payment = (id, date, value, extra = {}) => ({
  id,
  paid_at: date,
  amount: value,
  kind: "servicio",
  method: "transferencia",
  voided_at: null,
  service_id: null,
  appointment_id: null,
  ...extra,
})
const expense = (id, date, value, category = "otro", extra = {}) => ({
  id,
  spent_on: date,
  amount: value,
  category,
  description: null,
  voided_at: null,
  is_demo: false,
  ...extra,
})
const uuid = "00000000-0000-0000-0000-000000000001"
after(() => fs.rmSync(temp, { recursive: true, force: true }))

test("matches the workbook target scenario and full 24-month reference exactly", () => {
  const c = defaults(),
    monthly = projection(c, 0),
    report = buildCashflow(c, empty(), "2026-11-18")
  assert.equal(monthly.washes, workbook.source.originalWashes)
  assert.equal(monthly.receipts, workbook.source.originalRevenue)
  assert.equal(monthly.materials + monthly.worker + monthly.fees, workbook.source.originalVariable)
  assert.equal(monthly.fixed, workbook.source.originalFixed)
  assert.equal(monthly.net, workbook.source.originalMonthlyCash)
  assert.equal(report.investmentTotal, workbook.source.originalInvestment)
  assert.equal(report.inventoryTotal, workbook.source.originalInventory)
  assert.equal(report.depreciation, Math.round(workbook.source.originalDepreciation * 100) / 100)
  assert.equal(report.rows.length, 24)
  assert.equal(report.rows.at(-1).baselineCumulative, workbook.source.originalMonth24)
})
test("conservative and moderate scenarios retain the workbook results", () => {
  const c = defaults()
  c.scenario = "conservative"
  assert.equal(projection(c, 0).net, workbook.source.scenarioCash.conservative)
  c.scenario = "moderate"
  assert.equal(projection(c, 0).net, workbook.source.scenarioCash.moderate)
})
test("historical cash uses only active payments and expenses, never estimated costs or cached paid totals", () => {
  const d = empty()
  d.payments = [
    payment("p", "2026-10-10T12:00:00-03:00", 35000),
    payment("void", "2026-10-10T12:00:00-03:00", 5000, { voided_at: "2026-10-11" }),
  ]
  d.expenses = [
    expense("e", "2026-10-11", 10000, "productos"),
    expense("old", "2026-10-11", 5000, "productos", { voided_at: "2026-10-12" }),
  ]
  const r = buildCashflow(defaults(), d, "2026-11-18"),
    oct = r.rows.find((m) => m.month === "2026-10")
  assert.equal(oct.selected.receipts, 35000)
  assert.equal(oct.selected.expenses, 10000)
  assert.equal(oct.selected.net, 25000)
  assert.equal(oct.selected.worker, 0)
  assert.equal(oct.selected.workerRecorded, false)
  assert.equal(r.totals.net, 25000)
  assert.equal(oct.modelInvestment, workbook.source.originalInvestment)
})
test("wash and ticket metrics use work dates and vehicle counts, collections use bank dates", () => {
  const d = empty()
  d.appointments = [
    {
      id: "a",
      client_id: "c",
      status: "realizado",
      confirmed_start: "2026-10-10T12:00:00-03:00",
      requested_start: null,
      agreed_price: 35000,
      adjusted_price: null,
      discount: 0,
    },
  ]
  d.services = [
    { id: "s", appointment_id: "a", client_id: "c", performed_at: "2026-10-10T12:00:00-03:00", final_price: 35000 },
  ]
  d.vehicleLines = [{ appointment_id: "a" }, { appointment_id: "a" }]
  d.payments = [
    payment("deposit", "2026-10-01T01:00:00Z", 10000, { appointment_id: "a" }),
    payment("balance", "2026-11-01T01:00:00Z", 25000, { service_id: "s", appointment_id: "a" }),
  ]
  const r = buildCashflow(defaults(), d, "2026-11-18"),
    oct = r.rows.find((m) => m.month === "2026-10"),
    sep = r.rows.find((m) => m.month === "2026-09")
  assert.equal(r.earliestDate, "2026-09-30")
  assert.equal(sep.actual.serviceReceipts, 10000)
  assert.equal(oct.actual.serviceReceipts, 25000)
  assert.equal(oct.actual.washes, 2)
  assert.equal(oct.actual.ticket, 17500)
  assert.equal(oct.actual.jobs, 1)
  assert.equal(oct.actual.billed, 35000)
})
test("demo records are excluded through the related clients as well as direct expense/income flags", () => {
  const d = empty()
  d.demoClientIds = ["demo"]
  d.appointments = [{ id: "a", client_id: "demo", status: "realizado" }]
  d.services = [{ id: "s", appointment_id: "a", client_id: "demo", performed_at: "2026-10-10", final_price: 30000 }]
  d.payments = [payment("p", "2026-10-10", 30000, { service_id: "s", appointment_id: "a" })]
  d.expenses = [expense("e", "2026-10-10", 10000, "otro", { is_demo: true })]
  d.incomes = [{ id: "i", received_on: "2026-10-10", amount: 1000, concept: "Venta", is_demo: true }]
  const r = buildCashflow(defaults(), d, "2026-11-18")
  assert.equal(r.totals.net, 0)
  assert.equal(r.totals.washes, 0)
  assert.equal(r.earliestDate, null)
})
test("the current month is partial and a future month stays projected without filling historical gaps with estimates", () => {
  const d = empty()
  d.payments = [payment("p", "2026-11-01", 10000)]
  const r = buildCashflow(defaults(), d, "2026-11-18"),
    current = r.rows[0],
    next = r.rows[1]
  assert.equal(current.source, "partial")
  assert.equal(current.selected.receipts, 10000)
  assert.equal(current.forecast.receipts, 4620000)
  assert.equal(next.source, "forecast")
  assert.equal(next.selected.receipts, 4620000)
})
test("history beyond 24 months is never discarded", () => {
  const d = empty()
  d.payments = [payment("old", "2020-01-01", 100), payment("new", "2026-11-01", 200)]
  const r = buildCashflow(defaults(), d, "2026-11-18")
  assert.equal(r.rows[0].month, "2020-01")
  assert.equal(r.rows.at(-1).month, "2026-11")
  assert.equal(r.totals.receipts, 300)
  assert.ok(r.rows.length > 24)
  assert.ok(r.warnings.some((w) => w.includes("horizonte de 24 meses terminó")))
})
test("linking an investment expense counts the recorded amount once, even if the estimate differs", () => {
  const d = empty()
  d.expenses = [expense(uuid, "2026-10-10", 8000)]
  const c = defaults()
  c.investments = [{ ...c.investments[0], amount: 10000, expenseId: uuid, depreciate: false }]
  const r = buildCashflow(c, d, "2026-11-18")
  assert.equal(r.investmentTotal, 8000)
  assert.equal(r.unlinkedInvestment, 0)
  assert.equal(r.rows[0].actual.investment, 8000)
  assert.equal(r.rows[0].modeledCumulative, -8000)
  assert.equal(r.rows[0].modelInvestment, 0)
  assert.equal(r.rows[0].actual.operatingNet, 0)
})
test("an unlinked workbook investment remains a modeled amount, not a historical bank movement", () => {
  const c = defaults()
  c.investments = [{ ...c.investments[0], amount: 10000, depreciate: false }]
  const r = buildCashflow(c, empty(), "2026-11-18")
  assert.equal(r.totals.expenses, 0)
  assert.equal(r.rows[0].selected.net, 0)
  assert.equal(r.rows[0].modeledCumulative, -10000)
})
test("capital contributions do not inflate service turnover, operating cash or investment payback", () => {
  const c = defaults()
  c.investments = [{ ...c.investments[0], amount: 10000, depreciate: false }]
  const d = empty()
  d.incomes = [{ id: "i", received_on: "2026-11-10", amount: 100000, concept: "Aporte de socios", is_demo: false }]
  const r = buildCashflow(c, d, "2026-11-18")
  assert.equal(r.totals.capital, 100000)
  assert.equal(r.totals.operatingNet, 0)
  assert.equal(r.totals.billed, 0)
  assert.notEqual(r.modelPaybackMonth, "2026-11")
})
test("commission mapping uses exact normalized concepts and retains unclassified expenses in cash", () => {
  const d = empty()
  d.expenses = [
    expense("w", "2026-10-10", 1000, "otro", { description: "  HONORARIOS CRISTIAN " }),
    expense("f", "2026-10-10", 500, "otro", { description: "Comisión medios de pago" }),
    expense("x", "2026-10-10", 200, "otro", { description: "Otra cosa" }),
  ]
  const r = buildCashflow(defaults(), d, "2026-11-18")
  assert.equal(r.totals.worker, 1000)
  assert.equal(r.totals.fees, 500)
  assert.equal(r.totals.operating, 200)
  assert.equal(r.totals.expenses, 1700)
})
test("growth respects capacity, first-month operating days are used and scenarios remain editable", () => {
  const c = defaults()
  c.firstMonthOperatingDays = 10
  c.volumeGrowth = 100
  c.incomeInflation = 10
  assert.equal(projection(c, 0).washes, 70)
  assert.equal(projection(c, 1).washes, 154)
  assert.equal(projection(c, 1).receipts, 5082000)
})
test("cent amounts remain exact with more than a thousand movements", () => {
  const d = empty()
  d.payments = Array.from({ length: 1001 }, (_, i) => payment(String(i), "2026-10-10", 0.01))
  assert.equal(buildCashflow(defaults(), d, "2026-11-18").totals.receipts, 10.01)
})
test("future movements and invalid dates/amounts cannot silently distort historical cash", () => {
  const d = empty()
  d.payments = [payment("future", "2026-12-01", 1000)]
  assert.equal(buildCashflow(defaults(), d, "2026-11-18").totals.receipts, 0)
  assert.throws(() => argentinaDate("2026-02-30"))
  d.payments = [payment("bad", "2026-10-10", -1)]
  assert.throws(() => buildCashflow(defaults(), d, "2026-11-18"))
})
test("invalid settings, duplicate investment links and inconsistent partner shares are rejected", () => {
  for (const modify of [
    (c) => (c.ticket = NaN),
    (c) => (c.operatingDays = 0),
    (c) => (c.workerPercent = 101),
    (c) => (c.partners[0].percent = 20),
    (c) => {
      c.investments[0].expenseId = uuid
      c.investments[1].expenseId = uuid
    },
  ]) {
    const c = defaults()
    modify(c)
    assert.throws(() => validateConfig(c))
  }
})
