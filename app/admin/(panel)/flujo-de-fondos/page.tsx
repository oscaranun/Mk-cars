import type { Metadata } from "next"
import { CashflowDashboard } from "@/components/admin/cashflow/dashboard"
import { PageHeader } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { canAccess } from "@/lib/admin/permissions"
import { todayArgentina } from "@/lib/admin/format"
import { loadCashflowConfig, loadCashflowData } from "@/lib/cashflow/server"

export const metadata: Metadata = { title: "Flujo de fondos" }
export default async function CashflowPage() {
  const { supabase, profile, isAdmin } = await requireAdmin()
  if (!isAdmin || !canAccess(profile, "flujo-de-fondos"))
    return <p role="alert">No tenés permiso para ver el flujo de fondos.</p>
  const today = todayArgentina()
  let settings, data
  try {
    ;[settings, data] = await Promise.all([loadCashflowConfig(supabase), loadCashflowData(supabase, today)])
  } catch (error) {
    return (
      <>
        <PageHeader title="Flujo de fondos" description="Historial real y modelo de 24 meses" />
        <p role="alert" className="rounded-2xl border border-red-400/40 p-5 text-red-200">
          {error instanceof Error ? error.message : "No se pudieron consultar las fuentes del flujo."} Actualizá la
          página cuando la conexión esté disponible; no se muestran saldos en cero como sustituto de un error.
        </p>
      </>
    )
  }
  if (!settings)
    return (
      <>
        <PageHeader title="Flujo de fondos" description="Historial real y modelo de 24 meses" />
        <p role="status" className="rounded-2xl border border-border p-5">
          Falta cargar el modelo inicial del Excel en este entorno. Los importes se guardan de forma privada en la base
          del panel. El resto de las secciones sigue funcionando.
        </p>
      </>
    )
  const testEnvironment = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("lzkbhqknnsurxrjzzxvk.supabase.co")
  return (
    <>
      <PageHeader
        title="Flujo de fondos"
        description="Movimientos reales del panel y proyección editable de 24 meses, sin duplicar cobros ni inventar gastos históricos."
      />
      {testEnvironment && (
        <p role="status" className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4 text-sm text-amber-200">
          Entorno de pruebas: este informe utiliza la base de pruebas. No representa el historial de www.mkcars.com.ar.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Modelo de referencia: {settings.source.fileName}. Las cifras del Excel se conservan como supuestos editables, no
        como movimientos reales.
      </p>
      <CashflowDashboard
        initialConfig={settings.config}
        defaults={settings.originalConfig}
        version={settings.version}
        persisted={settings.persisted}
        available={settings.available}
        updatedAt={settings.updatedAt}
        canEdit={profile?.role === "owner"}
        data={data}
        today={today}
        observations={settings.observations}
      />
    </>
  )
}
