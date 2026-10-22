// Real Next server + Chromium; all Supabase/Maps responses below are synthetic.
// Run with Playwright available: node tests/zone-web-smoke.cjs
const http = require("node:http")
const { spawn } = require("node:child_process")
const assert = require("node:assert/strict")
const { chromium } = require("playwright")
const id = "00000000-0000-0000-0000-000000000001"
const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
}
let enabled = true,
  submission,
  configured
const zone = {
  id,
  name: "Zona de prueba",
  neighborhoods: ["Barrio de prueba"],
  polygon: null,
  priority: 0,
  active: false,
}
const settings = () => ({
  id: 1,
  enabled,
  minutes_per_vehicle: 90,
  horizon_days: 42,
  day_start: "09:00:00",
  day_end: "18:00:00",
  pause_start: null,
  pause_end: null,
  travel_minutes: 30,
  buffer_minutes: 0,
})
const backend = http.createServer(async (req, res) => {
  let raw = ""
  for await (const chunk of req) raw += chunk
  const body = raw ? JSON.parse(raw) : {},
    url = new URL(req.url, "http://localhost")
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Content-Range", "0-0/1")
  let data = []
  const path = url.pathname
  if (path === "/auth/v1/token") {
    const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url")
    data = {
      access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`,
      refresh_token: "synthetic-refresh",
      expires_in: 3600,
      token_type: "bearer",
      user,
    }
  } else if (path === "/auth/v1/user") data = user
  else if (path.endsWith("/rpc/is_admin")) data = true
  else if (path.endsWith("/zone_booking_settings"))
    data = req.headers.accept?.includes("vnd.pgrst.object") ? settings() : [settings()]
  else if (path.endsWith("/settings")) data = [{ vehicle_prices: { auto: 25000, suv: 30000, pickup: 35000 } }]
  else if (path.endsWith("/operating_zones")) data = [zone]
  else if (path.endsWith("/zone_service_types"))
    data = [{ id, name: "Lavado de prueba", minutes_per_vehicle: 90, active: true, is_default: true }]
  else if (path.endsWith("/mobile_units")) data = [{ id, name: "Partner de prueba", active: true, is_primary: true }]
  else if (path.endsWith("/rpc/zone_day_free_minutes")) data = 540
  else if (path.endsWith("/zone_weekly_schedule"))
    data = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      zone_ids: [id],
      flexible: false,
      enabled: weekday !== 0,
      capacity: 4,
    }))
  else if (path.endsWith("/rpc/zone_day_plan")) data = [{ zone_ids: [id], flexible: false, enabled: true, capacity: 4 }]
  else if (path.endsWith("/rpc/zone_day_used")) data = 0
  else if (path.endsWith("/rpc/zone_availability"))
    data = { enabled, zone: { id, name: zone.name }, manual: false, dates: [{ day, remaining: 4, full: false }] }
  else if (path.endsWith("/rpc/submit_zone_booking")) {
    submission = body
    data = id
  } else if (path.endsWith("/rpc/configure_zone_booking")) {
    configured = body
    data = null
  }
  res.end(JSON.stringify(data))
})

;(async () => {
  let app,
    browser,
    log = ""
  try {
    await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve))
    const backendUrl = `http://127.0.0.1:${backend.address().port}`
    app = spawn(
      process.execPath,
      [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3017"],
      {
        cwd: require("node:path").join(__dirname, ".."),
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: backendUrl,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
          SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "synthetic-maps",
          NEXT_TELEMETRY_DISABLED: "1",
          NODE_USE_ENV_PROXY: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    app.stdout.on("data", (b) => {
      log = (log + b).slice(-20000)
    })
    app.stderr.on("data", (b) => {
      log = (log + b).slice(-20000)
    })
    for (let n = 0; n < 100; n++) {
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
    page.setDefaultTimeout(15000)
    await page.addInitScript(() => {
      const listener = () => ({ remove() {} })
      class MockMap {
        addListener(name, callback) {
          window.__mkMapClick = callback
          return listener()
        }
      }
      class MockPolygon {
        constructor({ paths = [] }) {
          this.points = paths.map((p) => ({ lat: () => p.lat, lng: () => p.lng }))
          this.handlers = []
          this.path = {
            getArray: () => this.points,
            getLength: () => this.points.length,
            push: (p) => {
              this.points.push(p)
              this.handlers.forEach((fn) => fn())
            },
            removeAt: (i) => {
              this.points.splice(i, 1)
              this.handlers.forEach((fn) => fn())
            },
            clear: () => {
              this.points = []
              this.handlers.forEach((fn) => fn())
            },
            addListener: (_e, fn) => {
              this.handlers.push(fn)
              return listener()
            },
          }
        }
        getPath() {
          return this.path
        }
        setMap() {}
      }
      window.google = {
        maps: {
          importLibrary: async () => ({
            Map: MockMap,
            Polygon: MockPolygon,
            AutocompleteSessionToken: class {},
            AutocompleteSuggestion: {
              fetchAutocompleteSuggestions: async () => ({
                suggestions: [
                  {
                    placePrediction: {
                      placeId: "test",
                      mainText: "Dirección de prueba 123",
                      secondaryText: "Mendoza",
                      toPlace: () => ({
                        location: { lat: () => -32.9, lng: () => -68.85 },
                        formattedAddress: "Dirección de prueba 123, Mendoza",
                        addressComponents: [{ types: ["neighborhood"], longText: "Barrio de prueba" }],
                        fetchFields: async () => {},
                      }),
                    },
                  },
                ],
              }),
            },
          }),
        },
      }
    })
    await page.goto("http://127.0.0.1:3017/reservar")
    const outside = await page.request.get("http://127.0.0.1:3017/api/zone-availability?lat=0&lng=0&vehicles=1")
    assert.equal(outside.status(), 400, "Coverage must be checked on the server")
    assert.equal(await page.locator('select[name="time"]').count(), 0, "Enabled flow must not offer an exact time")
    await page.getByLabel("Nombre y apellido").fill("Cliente Prueba")
    await page.getByLabel("WhatsApp", { exact: false }).first().fill("2611234567")
    await page.getByLabel("Dirección", { exact: false }).first().fill("Dirección")
    await page.getByRole("option", { name: /Dirección de prueba/ }).click()
    await page.locator('select[name="date"]').selectOption(day)
    await page.getByRole("radio", { name: /Auto/ }).first().locator("..").click()
    assert.equal(await page.getByRole("radio", { name: /Auto/ }).first().isChecked(), true)
    await page.waitForTimeout(3100)
    await page.getByRole("button", { name: "Solicitar turno", exact: true }).click()
    await page.getByRole("heading", { name: "Solicitud recibida" }).waitFor()
    assert.equal(submission.p_day, day)
    assert.equal("requested_start" in submission.p_payload, false, "No fabricated requested time")
    assert.equal(submission.p_payload.neighborhood, "Barrio de prueba")
    assert.equal(submission.p_payload.service_type_id, id)
    console.log("PASS: public date-only booking and successful server submission (mock services)")
    enabled = false
    await page.goto("http://127.0.0.1:3017/reservar")
    await page.locator('select[name="time"]').waitFor()
    console.log("PASS: flag off preserves the existing time selector")
    enabled = true
    await page.goto("http://127.0.0.1:3017/admin/zonas")
    await page.waitForURL("**/admin/login")
    await page.getByLabel("Correo electrónico").fill("test@example.invalid")
    await page.getByLabel("Contraseña").fill("synthetic-password")
    await page.getByRole("button", { name: "Ingresar", exact: true }).click()
    await page.waitForURL("**/admin")
    await page.goto("http://127.0.0.1:3017/admin/zonas")
    await page.getByRole("heading", { name: "Zonas y recorridos", exact: true }).waitFor()
    page.on("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: "Guardar día", exact: true }).first().click()
    await page
      .getByText("Guardado. Las reservas existentes se conservan; revisá los recorridos afectados en la agenda.")
      .first()
      .waitFor()
    assert.equal(configured.p_kind, "weekly")
    await page.getByLabel("Inicio de jornada", { exact: true }).fill("08:00")
    await page.getByLabel("Fin de jornada", { exact: true }).fill("20:00")
    await page.getByLabel("Inicio de pausa (opcional)", { exact: true }).fill("12:00")
    await page.getByLabel("Fin de pausa", { exact: true }).fill("13:00")
    await page.getByLabel("Traslado entre domicilios (minutos)", { exact: true }).fill("25")
    await page.getByLabel("Margen adicional entre turnos (minutos)", { exact: true }).fill("10")
    await page.getByRole("button", { name: "Guardar modalidad", exact: true }).click()
    await page.waitForFunction(() => !document.querySelector("button[disabled]"))
    assert.equal(configured.p_kind, "settings")
    assert.equal(configured.p_data.day_start, "08:00")
    assert.equal(configured.p_data.buffer_minutes, 10)
    await page.getByRole("button", { name: "Editar límite en el mapa", exact: true }).first().click()
    await page.waitForFunction(() => !!window.__mkMapClick)
    await page.evaluate(() => {
      for (const [lat, lng] of [
        [-32.9, -68.85],
        [-32.91, -68.85],
        [-32.91, -68.86],
      ])
        window.__mkMapClick({ latLng: { lat: () => lat, lng: () => lng } })
    })
    await page.waitForFunction(() => !!document.querySelector('input[name="polygon"]')?.value)
    const ring = JSON.parse(await page.locator('input[name="polygon"]').first().inputValue())
    assert.equal(ring.length, 4)
    assert.deepEqual(ring[0], ring[3])
    console.log("PASS: editable operating hours, pause, travel, margin and visual zone editor (mock Maps)")
    await page.goto("http://127.0.0.1:3017/admin/agenda-servicios")
    await page.getByRole("heading", { name: "Agenda de servicios", exact: true }).waitFor()
    assert.equal(await page.getByRole("link", { name: /^Domingo / }).count(), 1)
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "Admin page must fit mobile width",
    )
    await page.goto("http://127.0.0.1:3017/reservar")
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "Public form must fit mobile width",
    )
    console.log("PASS: authenticated admin views, seven-day agenda; unauthenticated redirect")
  } catch (e) {
    console.error(e)
    console.error(log.slice(-4000))
    process.exitCode = 1
  } finally {
    if (browser) await browser.close()
    if (app) app.kill("SIGTERM")
    await new Promise((r) => backend.close(r))
  }
})()
