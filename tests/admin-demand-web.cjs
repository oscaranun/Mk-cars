// Browser checks against a real Next server. Every backend response is synthetic.
const http = require("node:http")
const { spawn } = require("node:child_process")
const assert = require("node:assert/strict")
const { chromium } = require("playwright")
const id = "00000000-0000-0000-0000-000000000001"
const paymentId = "00000000-0000-0000-0000-000000000002"
const now = new Date().toISOString()
const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: now,
}
const vehicle = {
  id,
  category: "auto",
  category_label: null,
  brand: "Marca prueba",
  model: "Modelo prueba",
  plate: "TEST123",
  created_at: now,
}
const payment = {
  id: paymentId,
  amount: 500.25,
  method: "transferencia",
  paid_at: `${day}T15:30:00-03:00`,
  created_at: now,
  appointment_id: id,
  voided_at: null,
  kind: "servicio",
  notes: null,
  concept: null,
}
const appointment = {
  id,
  requested_start: null,
  confirmed_start: `${day}T09:00:00-03:00`,
  service: "Lavado prueba",
  status: "realizado",
  address: "Dirección ficticia 123",
  payment_status: "parcial",
  amount_paid: 500.25,
  adjusted_price: null,
  agreed_price: 1250.5,
  discount: 0,
  duration_minutes: 90,
  operator: null,
  service_started_at: null,
  clients: { id, full_name: "Cliente Prueba", whatsapp: "5492619999999" },
  services: [{ final_price: 1250.5 }],
  vehicles: vehicle,
}
const client = {
  id,
  full_name: "Cliente Prueba",
  whatsapp: "5492619999999",
  email: null,
  source: "whatsapp",
  notes: null,
  created_at: now,
  last_interaction_at: now,
  marketing_consent: false,
  privacy_consent_at: null,
  archived_at: null,
  archive_reason: null,
  follow_up_at: null,
  review_status: "pendiente",
  review_requested_at: null,
  review_received_at: null,
  vehicles: [vehicle],
  inquiries: [],
  appointments: [appointment],
  services: [
    {
      id,
      appointment_id: id,
      performed_at: appointment.confirmed_start,
      wash_type: "Lavado prueba",
      final_price: 1250.5,
      amount_paid: 500.25,
      payment_status: "parcial",
      payments: [payment],
    },
  ],
}
const calls = []
let failExpenses = false
const backend = http.createServer(async (req, res) => {
  let raw = ""
  for await (const chunk of req) raw += chunk
  const body = raw ? JSON.parse(raw) : {},
    url = new URL(req.url, "http://localhost"),
    path = url.pathname
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Content-Range", "0-0/1")
  let data = []
  if (path === "/auth/v1/token") {
    const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url")
    data = {
      access_token: `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
      refresh_token: "synthetic-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user,
    }
  } else if (path === "/auth/v1/user") data = user
  else if (path.endsWith("/rpc/is_admin")) data = true
  else if (path.endsWith("/admins"))
    data = [{ user_id: id, role: "owner", permissions: [], full_name: "Administrador Prueba" }]
  else if (path.endsWith("/clients")) data = [client]
  else if (path.endsWith("/settings"))
    data = [
      {
        id: 1,
        vehicle_prices: { auto: 25000, suv: 30000, pickup: 35000 },
        loyalty_every: 6,
        duration_defaults: { auto: 60, suv: 75, pickup: 90 },
      },
    ]
  else if (path.endsWith("/appointments")) data = [appointment]
  else if (path.endsWith("/services")) data = [{ ...client.services[0], clients: { id, full_name: client.full_name } }]
  else if (path.endsWith("/appointment_vehicles"))
    data = [
      {
        appointment_id: id,
        position: 1,
        category: "auto",
        price_applied: 1250.5,
        needs_review: false,
        vehicle_id: id,
        vehicles: vehicle,
      },
    ]
  else if (path.endsWith("/payments")) data = [payment]
  else if (path.endsWith("/expenses") && failExpenses) {
    res.statusCode = 503
    data = { code: "PGRST000", message: "Synthetic failure" }
  } else if (path.includes("/rpc/")) {
    calls.push({ path, body })
    data = path.endsWith("admin_correct_payment") ? paymentId : id
  }
  if (Array.isArray(data) && req.headers.accept?.includes("vnd.pgrst.object")) data = data[0] ?? null
  res.end(JSON.stringify(data))
})

;(async () => {
  let app,
    browser,
    log = ""
  try {
    await new Promise((r) => backend.listen(0, "127.0.0.1", r))
    app = spawn(
      process.execPath,
      [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3027"],
      {
        cwd: require("node:path").join(__dirname, ".."),
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
          SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
          MK_CARS_RESERVATION_MODE: "demand",
          NEXT_TELEMETRY_DISABLED: "1",
          NODE_USE_ENV_PROXY: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    const collect = (b) => {
      log = (log + b).slice(-18000)
    }
    app.stdout.on("data", collect)
    app.stderr.on("data", collect)
    for (let i = 0; i < 150; i++) {
      if (log.includes("Ready in")) break
      if (app.exitCode !== null) throw Error(log)
      await new Promise((r) => setTimeout(r, 100))
    }
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    })
    const page = await browser.newPage()
    page.setDefaultTimeout(20000)
    await page.goto("http://127.0.0.1:3027/admin/login")
    await page.getByLabel("Correo electrónico").fill(user.email)
    await page.getByLabel("Contraseña", { exact: true }).fill("synthetic-password")
    await page.getByRole("button", { name: "Ingresar", exact: true }).click()
    await page.waitForURL("**/admin")
    const nav = page.getByRole("navigation", { name: "Secciones del panel" })
    assert.equal(await nav.getByRole("link").count(), 5)
    assert.equal(await nav.getByRole("link", { name: /recorrido|zonas/i }).count(), 0)
    await page.goto(`http://127.0.0.1:3027/admin/clientes/${id}`)
    await page.getByRole("tab", { name: "Turnos y cobros", exact: true }).waitFor()
    const panel = page.getByRole("tabpanel", { name: "Turnos y cobros", exact: true })
    await panel.getByText("Corregir este ingreso sin salir de la ficha", { exact: true }).click()
    const correction = panel
      .locator("form")
      .filter({ has: page.locator(`input[name="payment_id"][value="${paymentId}"]`) })
    await correction.getByLabel("Importe", { exact: true }).fill("500.50")
    await correction.getByLabel("Fecha y hora real del cobro").fill(`${day}T14:20`)
    await correction.getByLabel("Motivo de la corrección").fill("Fecha real del banco")
    await correction.getByRole("button", { name: "Guardar corrección", exact: true }).click()
    await page.getByText("Ingreso corregido. El saldo del servicio se recalculó.", { exact: true }).waitFor()
    const call = calls.find((c) => c.path.endsWith("admin_correct_payment"))
    assert.equal(call.body.p_amount, 500.5)
    assert.equal(call.body.p_paid_at, `${day}T14:20:00-03:00`)
    assert.equal(call.body.p_adjust_price, false)
    console.log("PASS: correction inside client workspace preserves cents and real bank date")
    await page.getByRole("tab", { name: "Vehículos", exact: true }).click()
    assert.equal(await page.getByRole("tabpanel", { name: "Vehículos", exact: true }).isVisible(), true)
    await page.getByRole("tab", { name: "Vehículos", exact: true }).press("ArrowLeft")
    assert.equal(await page.getByRole("tab", { name: "Datos", exact: true }).getAttribute("aria-selected"), "true")
    await page.getByRole("tab", { name: "Turnos y cobros", exact: true }).click()
    await page.getByText("Cargar un lavado ya realizado", { exact: true }).click()
    const historical = panel.locator("form").filter({ has: page.locator('input[name="request_id"]') })
    await historical.getByLabel("Fecha", { exact: true }).fill(day)
    await historical.getByLabel("Hora real del lavado").fill("06:15")
    await historical.getByLabel("Importe del servicio", { exact: true }).fill("1250.50")
    await historical.getByLabel("Importe ya cobrado", { exact: false }).fill("500.25")
    await historical.getByLabel("Fecha y hora real del cobro").fill(`${day}T17:45`)
    await historical.getByRole("button", { name: "Registrar lavado", exact: true }).click()
    await page.waitForFunction(() => window.location.hash === "#turnos")
    const historicalCall = calls.find((c) => c.path.endsWith("admin_register_demand_service"))
    assert.equal(historicalCall.body.p.performed_at, `${day}T06:15:00-03:00`)
    assert.equal(historicalCall.body.p.paid_at, `${day}T17:45:00-03:00`)
    assert.equal(historicalCall.body.p.vehicle_id, id)
    assert.equal(historicalCall.body.p.final_price, 1250.5)
    assert.equal(historicalCall.body.p.amount_paid, 500.25)
    console.log("PASS: historical service inline, saved vehicle, independent dates and no business-hours restriction")
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "Client workspace fits mobile",
    )
    await page.screenshot({ path: "/tmp/mk-cars-client-demand-mobile.png", fullPage: true })
    await page.goto("http://127.0.0.1:3027/admin/cierre")
    assert.equal(await page.getByLabel("Contado en Efectivo", { exact: true }).inputValue(), "")
    await page.getByLabel("Saldo inicial en Efectivo", { exact: true }).fill("1000.50")
    await page.getByLabel("Contado en Efectivo", { exact: true }).fill("1000.50")
    await page.getByLabel("Contado en Transferencia", { exact: true }).fill("500.25")
    await page.getByLabel("Contado en Mercado Pago", { exact: true }).fill("0")
    await page.getByLabel("Contado en Otro", { exact: true }).fill("0")
    await page.getByRole("button", { name: "Guardar cierre", exact: true }).click()
    await page
      .getByText("Cierre guardado con su historial. Revisá las diferencias de cada medio.", { exact: true })
      .waitFor()
    const closing = calls.find((c) => c.path.endsWith("admin_save_cash_closing"))
    assert.equal(closing.body.p_opening.efectivo, 1000.5)
    assert.equal(closing.body.p_counted.transferencia, 500.25)
    console.log("PASS: explicit count, opening balance, transaction-based closing")
    failExpenses = true
    await page.goto("http://127.0.0.1:3027/admin/movimientos")
    await page.getByRole("alert").filter({ hasText: "No se pudieron consultar" }).waitFor()
    assert.equal(await page.getByText("No hay movimientos con estos filtros.", { exact: true }).count(), 0)
    console.log("PASS: failed financial queries never look like an empty ledger")
    await page.goto("http://127.0.0.1:3027/reservar")
    assert.equal(
      await page.locator('select[name="time"],select[name="date"],input[name="time"],input[name="date"]').count(),
      0,
    )
    console.log("PASS: default public request remains on demand without published zones or time selection")
  } catch (error) {
    console.error(error)
    console.error(log.slice(-4500))
    process.exitCode = 1
  } finally {
    if (browser) await browser.close()
    if (app) app.kill("SIGTERM")
    await new Promise((r) => backend.close(r))
  }
})()
