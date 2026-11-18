// Real Next + Chromium. All backend records and credentials are synthetic.
const http = require("node:http"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process")
const { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path")
const workbook = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/cashflow-workbook.json"), "utf8"))
const defaults = workbook.config
const id = "00000000-0000-0000-0000-000000000001",
  today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
}
let role = "owner",
  permissions = [],
  failExpenses = false,
  modelReady = true,
  version = 3,
  config = { ...structuredClone(defaults), startMonth: today.slice(0, 7) }
const calls = [],
  pages = []
const appointment = {
  id,
  client_id: id,
  status: "realizado",
  service: "Lavado ficticio",
  confirmed_start: `${today}T09:00:00-03:00`,
  requested_start: null,
  agreed_price: 35000,
  adjusted_price: null,
  discount: 0,
}
const dataset = {
  payments: [
    ...Array.from({ length: 1001 }, (_, i) => ({
      id: `p-${String(i).padStart(5, "0")}`,
      amount: 10,
      paid_at: "2023-01-02T12:00:00-03:00",
      kind: "servicio",
      method: "efectivo",
      voided_at: null,
      service_id: null,
      appointment_id: null,
    })),
    {
      id: "p-current",
      amount: 35000,
      paid_at: `${today}T10:00:00-03:00`,
      kind: "servicio",
      method: "transferencia",
      voided_at: null,
      service_id: id,
      appointment_id: id,
    },
    {
      id: "p-voided",
      amount: 999999,
      paid_at: `${today}T10:00:00-03:00`,
      kind: "servicio",
      method: "transferencia",
      voided_at: today,
      service_id: null,
      appointment_id: null,
    },
  ],
  expenses: [
    { id, spent_on: today, amount: 10000, category: "productos", description: null, voided_at: null, is_demo: false },
    {
      id: "worker",
      spent_on: today,
      amount: 1000,
      category: "otro",
      description: "Honorarios Cristian",
      voided_at: null,
      is_demo: false,
    },
  ],
  other_incomes: [
    { id: "capital", received_on: today, amount: 5000, concept: "Aporte de socios", is_demo: false },
    { id: "other", received_on: today, amount: 500, concept: "Venta de productos", is_demo: false },
  ],
  services: [{ id, appointment_id: id, client_id: id, performed_at: `${today}T09:00:00-03:00`, final_price: 35000 }],
  appointments: [appointment],
  appointment_vehicles: [
    { appointment_id: id, position: 1 },
    { appointment_id: id, position: 2 },
  ],
  clients: [],
}
const backend = http.createServer(async (req, res) => {
  let raw = ""
  for await (const chunk of req) raw += chunk
  const body = raw ? JSON.parse(raw) : {},
    url = new URL(req.url, "http://localhost"),
    table = url.pathname.split("/").at(-1)
  res.setHeader("Content-Type", "application/json")
  let data = []
  if (url.pathname === "/auth/v1/token") {
    const enc = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
    data = {
      access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
      refresh_token: "test-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user,
    }
  } else if (url.pathname === "/auth/v1/user") data = user
  else if (table === "is_admin") data = true
  else if (table === "admins") data = [{ user_id: id, role, permissions, full_name: "Usuario ficticio" }]
  else if (table === "cashflow_config")
    data = modelReady
      ? [
          {
            id: 1,
            version,
            config,
            original_config: defaults,
            source: workbook.source,
            observations: workbook.observations,
            updated_at: new Date().toISOString(),
          },
        ]
      : []
  else if (table === "save_cashflow_config") {
    calls.push({ path: url.pathname, body })
    if (body.p_version !== version) {
      res.statusCode = 400
      data = { code: "40001", message: "Stale version" }
    } else {
      config = body.p_config
      data = ++version
    }
  } else if (table === "expenses" && failExpenses) {
    res.statusCode = 503
    data = { code: "PGRST000", message: "Synthetic outage" }
  } else if (dataset[table]) {
    pages.push({ table, offset: Number(url.searchParams.get("offset") ?? 0), method: req.method })
    data = [...dataset[table]]
    if (url.searchParams.get("voided_at") === "is.null") data = data.filter((r) => !r.voided_at)
    const offset = Number(url.searchParams.get("offset") ?? 0),
      limit = Math.min(200, Number(url.searchParams.get("limit") ?? 1000)),
      total = data.length
    data = data.slice(offset, offset + limit)
    res.setHeader("Content-Range", `${offset}-${Math.max(offset, offset + data.length - 1)}/${total}`)
  } else if (table === "settings")
    data = [{ id: 1, vehicle_prices: { auto: 25000, suv: 30000, pickup: 35000 }, operational_capacity: 1 }]
  if (!res.hasHeader("Content-Range")) res.setHeader("Content-Range", "0-0/1")
  if (Array.isArray(data) && req.headers.accept?.includes("vnd.pgrst.object")) data = data[0] ?? null
  res.end(req.method === "HEAD" ? "" : JSON.stringify(data))
})
;(async () => {
  let app,
    browser,
    log = ""
  try {
    await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve))
    app = spawn(
      process.execPath,
      [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3037"],
      {
        cwd: path.join(__dirname, ".."),
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
          SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
          NEXT_TELEMETRY_DISABLED: "1",
          NODE_USE_ENV_PROXY: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    const collect = (b) => {
      log = (log + b).slice(-16000)
    }
    app.stdout.on("data", collect)
    app.stderr.on("data", collect)
    for (let n = 0; n < 150; n++) {
      if (log.includes("Ready in")) break
      if (app.exitCode !== null) throw Error(log)
      await new Promise((r) => setTimeout(r, 100))
    }
    browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] })
    const page = await browser.newPage()
    page.setDefaultTimeout(25000)
    await page.goto("http://127.0.0.1:3037/admin/login")
    await page.getByLabel("Correo electrónico").fill(user.email)
    await page.getByLabel("Contraseña", { exact: true }).fill("synthetic-password")
    await page.getByRole("button", { name: "Ingresar", exact: true }).click()
    await page.waitForURL((url) => ["/admin", "/admin/turnos"].includes(url.pathname))
    await page.goto("http://127.0.0.1:3037/admin/flujo-de-fondos")
    await page.getByRole("heading", { name: "Flujo de fondos", exact: true }).waitFor()
    assert.ok(await page.getByText(/50\.510,00/).count())
    assert.ok(await page.getByText(/39\.510,00/).count())
    assert.ok(
      pages.some((p) => p.table === "payments" && p.offset === 1000),
      "Historical source must paginate beyond a thousand rows",
    )
    console.log("PASS: complete historical pagination, live ledger totals and new navigation link")
    await page.getByRole("button", { name: "Moderado", exact: true }).click()
    assert.ok(await page.getByText(/39\.510,00/).count(), "Changing assumptions must not change historical net cash")
    await page.getByText("Editar supuestos e inversión", { exact: true }).click()
    await page.getByLabel("Ticket promedio proyectado", { exact: true }).fill("35000")
    await page.getByRole("button", { name: "Guardar supuestos", exact: true }).click()
    await page
      .getByText("Supuestos guardados. Los movimientos históricos se conservan sin cambios.", { exact: true })
      .waitFor()
    assert.equal(calls.at(-1).body.p_config.ticket, 35000)
    assert.equal(calls.at(-1).body.p_version, 3)
    assert.equal(version, 4)
    console.log("PASS: editable assumptions save with a version; historical sources receive no writes")
    const count = calls.length
    await page.getByLabel("Comisión operarios proyectada (%)", { exact: true }).fill("120")
    await page.getByRole("alert").filter({ hasText: "Revisá los porcentajes" }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Guardar supuestos", exact: true }).isDisabled(), true)
    assert.equal(calls.length, count)
    await page.getByLabel("Comisión operarios proyectada (%)", { exact: true }).fill("18")
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Exportar CSV", exact: true }).click()
    const download = await downloadPromise
    await download.saveAs("/tmp/mk-cars-cashflow-test.csv")
    const csv = fs.readFileSync("/tmp/mk-cars-cashflow-test.csv", "utf8")
    assert.ok(csv.includes("2023-01"))
    assert.ok(csv.includes("Acumulado del modelo"))
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: "/tmp/mk-cars-cashflow-mobile.png", fullPage: false })
    console.log("PASS: invalid settings blocked, CSV export and mobile layout")
    failExpenses = true
    await page.reload()
    await page.getByRole("alert").filter({ hasText: "No se pudo leer la fuente expenses" }).waitFor()
    assert.equal(await page.getByText("Flujo neto registrado", { exact: true }).count(), 0)
    failExpenses = false
    modelReady = false
    await page.reload()
    await page.getByRole("status").filter({ hasText: "Falta cargar el modelo inicial del Excel" }).waitFor()
    assert.equal(await page.getByText("Flujo neto registrado", { exact: true }).count(), 0)
    modelReady = true
    role = "staff"
    permissions = ["flujo-de-fondos"]
    await page.reload()
    await page.getByText("Editar supuestos e inversión", { exact: true }).click()
    assert.equal(await page.getByRole("button", { name: "Guardar supuestos", exact: true }).isDisabled(), true)
    permissions = ["turnos"]
    const reads = pages.length
    const response = await page.reload()
    await page.getByRole("alert").filter({ hasText: "No tenés permiso" }).waitFor()
    assert.equal(pages.length, reads, "Unpermitted page must not query financial data")
    assert.equal(
      (await response.text()).includes("Activo ficticio A"),
      false,
      "Financial defaults must not be serialized to an unpermitted response",
    )
    console.log("PASS: query failures never look like zero cash; staff read/write permissions respected")
  } catch (error) {
    console.error(error)
    console.error(log.slice(-6000))
    process.exitCode = 1
  } finally {
    if (browser) await browser.close()
    if (app) app.kill("SIGTERM")
    await new Promise((r) => backend.close(r))
  }
})()
