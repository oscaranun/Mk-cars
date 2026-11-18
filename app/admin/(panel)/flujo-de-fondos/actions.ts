"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { validateConfig } from "@/lib/cashflow/config"
import { buildCashflow } from "@/lib/cashflow/model"
import type { Dataset } from "@/lib/cashflow/types"
import { todayArgentina } from "@/lib/admin/format"

export type SaveState = { ok: boolean; message: string | null; version?: number }
export async function saveCashflow(_previous: SaveState, form: FormData): Promise<SaveState> {
  const { supabase, isAdmin, profile } = await requireAdmin()
  if (!isAdmin || profile?.role !== "owner")
    return { ok: false, message: "Solo el propietario puede guardar los supuestos financieros." }
  const raw = String(form.get("config") ?? "")
  const version = Number(form.get("version"))
  if (raw.length > 100_000 || !Number.isSafeInteger(version) || version < 0)
    return { ok: false, message: "Configuración o versión inválida." }
  let config
  try {
    config = validateConfig(JSON.parse(raw))
    const empty: Dataset = {
      payments: [],
      expenses: [],
      incomes: [],
      services: [],
      appointments: [],
      vehicleLines: [],
      demoClientIds: [],
      warnings: [],
    }
    buildCashflow(config, empty, todayArgentina())
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Revisá los supuestos." }
  }
  const { data, error } = await supabase.rpc("save_cashflow_config", { p_config: config, p_version: version })
  if (error) {
    if (error.code === "40001")
      return {
        ok: false,
        message: "Otro usuario guardó cambios. Recargá antes de volver a guardar para no sobrescribirlos.",
      }
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      return { ok: false, message: "Falta instalar la actualización 033 para guardar los supuestos en esta base." }
    return { ok: false, message: "No se pudieron guardar los supuestos. Los datos históricos no se modificaron." }
  }
  revalidatePath("/admin/flujo-de-fondos")
  return {
    ok: true,
    message: "Supuestos guardados. Los movimientos históricos se conservan sin cambios.",
    version: Number(data),
  }
}
