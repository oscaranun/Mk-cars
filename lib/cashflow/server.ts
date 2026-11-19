import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { validateConfig } from "./config"
import type { CashAppointment, CashExpense, CashIncome, CashPayment, CashService, Config, Dataset } from "./types"

const missingTable = (code?: string) => code === "42P01" || code === "PGRST205"

/** Range pagination avoids silently truncating historical data at PostgREST's row cap. */
async function readAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  options: {
    today: string
    date?: string
    timestamp?: boolean
    active?: boolean
    demoOnly?: boolean
    order?: string[]
  },
): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 500
  let offset = 0,
    total: number | null = null
  const seen = new Set<string>()
  for (;;) {
    let query = supabase.from(table).select(columns, offset === 0 ? { count: "exact" } : {})
    for (const column of options.order ?? ["id"]) query = query.order(column, { ascending: true })
    if (options.active) query = query.is("voided_at", null)
    if (options.demoOnly) query = query.eq("is_demo", true)
    if (options.date) {
      if (options.timestamp) {
        const date = new Date(`${options.today}T12:00:00Z`)
        date.setUTCDate(date.getUTCDate() + 1)
        query = query.lt(options.date, `${date.toISOString().slice(0, 10)}T00:00:00-03:00`)
      } else query = query.lte(options.date, options.today)
    }
    const { data, error, count } = await query.range(offset, offset + pageSize - 1)
    if (error)
      throw Object.assign(Error(`No se pudo leer la fuente ${table}. No se calculó un flujo incompleto.`), {
        code: error.code,
        source: table,
      })
    if (offset === 0) total = count
    const batch = (data ?? []) as unknown as T[]
    if (!batch.length) {
      if (total !== null && offset < total)
        throw Error(`La fuente ${table} cambió durante la lectura. Actualizá para completar el historial.`)
      return rows
    }
    for (const row of batch) {
      const identity = row as { id?: string; appointment_id?: string; position?: number }
      const key = identity.id ?? `${identity.appointment_id}:${identity.position}`
      if (seen.has(key)) throw Error(`La fuente ${table} cambió durante la lectura. Actualizá para evitar duplicados.`)
      seen.add(key)
    }
    rows.push(...batch)
    offset += batch.length
    if (total !== null ? offset >= total : batch.length < pageSize) return rows
  }
}

export async function loadCashflowData(supabase: SupabaseClient, today: string): Promise<Dataset> {
  const options = { today }
  const warnings: string[] = []
  const [payments, expenses, incomes, services, appointments, vehicleLines, demoClients] = await Promise.all([
    readAll<CashPayment>(supabase, "payments", "id,amount,paid_at,kind,method,voided_at,service_id,appointment_id", {
      ...options,
      date: "paid_at",
      timestamp: true,
      active: true,
    }),
    readAll<CashExpense>(supabase, "expenses", "id,amount,spent_on,category,description,subconcept,voided_at,is_demo", {
      ...options,
      date: "spent_on",
      active: true,
    }),
    readAll<CashIncome>(supabase, "other_incomes", "id,amount,received_on,concept,is_demo", {
      ...options,
      date: "received_on",
    }).catch((error: unknown) => {
      if (!missingTable((error as { code?: string }).code)) throw error
      warnings.push(
        "Esta base todavía no tiene la fuente de otros ingresos manuales. Se incluyen los cobros registrados; revisá la configuración de Finanzas si faltan movimientos.",
      )
      return []
    }),
    readAll<CashService>(supabase, "services", "id,appointment_id,client_id,performed_at,final_price", {
      ...options,
      date: "performed_at",
      timestamp: true,
    }),
    readAll<CashAppointment>(
      supabase,
      "appointments",
      "id,client_id,status,confirmed_start,requested_start,agreed_price,adjusted_price,discount",
      options,
    ),
    readAll<{ appointment_id: string }>(supabase, "appointment_vehicles", "appointment_id,position", {
      ...options,
      order: ["appointment_id", "position"],
    }),
    readAll<{ id: string }>(supabase, "clients", "id", { ...options, demoOnly: true }),
  ])
  return {
    payments,
    expenses,
    incomes,
    services,
    appointments,
    vehicleLines,
    demoClientIds: demoClients.map((c) => c.id),
    warnings,
  }
}

export type SavedConfig = {
  config: Config
  originalConfig: Config
  source: { fileName: string }
  observations: string[]
  version: number
  persisted: boolean
  available: boolean
  updatedAt: string | null
}
export async function loadCashflowConfig(supabase: SupabaseClient): Promise<SavedConfig | null> {
  const { data, error } = await supabase
    .from("cashflow_config")
    .select("config,original_config,source,observations,version,updated_at")
    .eq("id", 1)
    .maybeSingle()
  if (error && !missingTable(error.code)) throw Error("No se pudo consultar la configuración financiera.")
  if (!data) return null
  return {
    config: validateConfig(data.config),
    originalConfig: validateConfig(data.original_config ?? data.config),
    source: {
      fileName: typeof data.source?.fileName === "string" ? data.source.fileName : "Modelo financiero cargado",
    },
    observations: Array.isArray(data.observations)
      ? data.observations.filter((v: unknown) => typeof v === "string")
      : [],
    version: data.version,
    persisted: true,
    available: true,
    updatedAt: data.updated_at,
  }
}
