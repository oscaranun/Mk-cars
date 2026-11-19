"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { saveCashflow, type SaveState } from "@/app/admin/(panel)/flujo-de-fondos/actions"
import { buildCashflow } from "@/lib/cashflow/model"
import { buildRealFlow } from "@/lib/cashflow/real"
import type { Config, Dataset } from "@/lib/cashflow/types"
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui"
import { RealFlowTab } from "./real-flow"
import { SupuestosTab } from "./supuestos"
import { CashflowMaster } from "./master"

const whole = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const TABS = [
  ["real", "Flujo real"],
  ["supuestos", "Supuestos"],
  ["master", "Master"],
] as const
type Tab = (typeof TABS)[number][0]

export function CashflowDashboard({
  initialConfig,
  defaults,
  version: initialVersion,
  persisted,
  available,
  canEdit,
  data,
  today,
  observations,
  updatedAt,
}: {
  initialConfig: Config
  defaults: Config
  version: number
  persisted: boolean
  available: boolean
  canEdit: boolean
  data: Dataset
  today: string
  observations: string[]
  updatedAt: string | null
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("real")
  const [config, setConfig] = useState(initialConfig)
  const [version, setVersion] = useState(initialVersion)
  const [saved, setSaved] = useState(JSON.stringify(initialConfig))
  const [state, save, pending] = useActionState<SaveState, FormData>(saveCashflow, { ok: false, message: null })
  useEffect(() => {
    if (state.ok && state.version) {
      setVersion(state.version)
      setSaved(JSON.stringify(config))
    }
  }, [state]) // fields are disabled while saving, so config cannot change mid-save
  const result = useMemo(() => {
    try {
      return {
        report: buildCashflow(config, data, today),
        flow: buildRealFlow(config, data, today),
        error: null,
      }
    } catch (error) {
      return {
        report: null,
        flow: null,
        error: error instanceof Error ? error.message : "No se pudo calcular el flujo.",
      }
    }
  }, [config, data, today])
  const dirty = JSON.stringify(config) !== saved

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-3 rounded-2xl border border-border bg-background/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Secciones del flujo de fondos" className="flex gap-1 rounded-xl bg-muted/40 p-1">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                onClick={() => setTab(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <form action={save} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="config" value={JSON.stringify(config)} />
            <input type="hidden" name="version" value={version} />
            {dirty && <span className="text-xs text-amber-200">Cambios sin guardar</span>}
            <button type="button" className={secondaryButtonClass} onClick={() => router.refresh()}>
              Actualizar datos
            </button>
            {canEdit && (
              <button
                type="submit"
                className={primaryButtonClass}
                disabled={!available || pending || !dirty || Boolean(result.error)}
              >
                {pending ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </form>
        </div>
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {state.message ? (
            <span className={state.ok ? "text-emerald-300" : "text-red-200"}>{state.message}</span>
          ) : persisted ? (
            `Configuración guardada · versión ${version}${updatedAt ? ` · ${new Date(updatedAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}` : ""}`
          ) : (
            "Configuración inicial · todavía no guardada"
          )}
          {!available && " · El guardado no está habilitado en este entorno."}
          {!canEdit && " · Solo el propietario puede modificar la configuración."}
        </p>
      </div>

      {result.error && (
        <p role="alert" className="rounded-2xl border border-red-400/40 p-4 text-sm text-red-200">
          {result.error} Corregí el dato para volver a calcular.
        </p>
      )}

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-w-0">
        {tab === "real" && result.flow && result.report && (
          <RealFlowTab
            flow={result.flow}
            washes={result.report.totals.washes}
            ticket={result.report.totals.ticket}
            config={config}
            setConfig={setConfig}
            canEdit={canEdit && !pending}
            onOpenMaster={() => setTab("master")}
          />
        )}
        {tab === "supuestos" && result.report && (
          <SupuestosTab
            config={config}
            setConfig={setConfig}
            report={result.report}
            flow={result.flow}
            data={data}
            defaults={defaults}
            canEdit={canEdit}
            pending={pending}
            today={today}
            observations={observations}
          />
        )}
        {tab === "master" && (
          <CashflowMaster
            config={config}
            setConfig={setConfig}
            data={data}
            disabled={!canEdit || pending}
            today={today}
            money={(v) => whole.format(v)}
          />
        )}
      </div>
    </div>
  )
}
