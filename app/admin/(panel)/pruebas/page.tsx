import type { Metadata } from "next"
import { purgeDemoData, seedDemoData } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { Badge, Card, PageHeader, SectionTitle, Stat, dangerButtonClass, fieldClass, labelClass } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"

export const metadata: Metadata = { title: "Datos de prueba" }

type DemoStatus = {
  clients: number
  appointments: number
  services: number
  expenses: number
  auto_purge_scheduled: boolean
}

export default async function DemoDataPage() {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.rpc("demo_data_status")
  const status = data as DemoStatus | null
  const loaded = (status?.clients ?? 0) > 0

  return (
    <>
      <PageHeader
        title="Datos de prueba"
        description="Clientes, autos, turnos y cobros ficticios para practicar con el panel sin tocar tus datos reales."
      />

      {error || !status ? (
        <Card>
          <p className="text-sm text-red-200">No se pudo leer el estado de los datos de prueba.</p>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <SectionTitle
              aside={<Badge tone={loaded ? "warning" : "neutral"}>{loaded ? "Cargados" : "Sin datos de prueba"}</Badge>}
            >
              Estado
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Clientes" value={status.clients} />
              <Stat label="Turnos" value={status.appointments} />
              <Stat label="Servicios" value={status.services} />
              <Stat label="Gastos" value={status.expenses} />
            </div>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground text-pretty">
              <li>
                Los clientes de prueba terminan en <strong className="text-foreground">(demo)</strong> y tienen WhatsApp
                que empieza con 549 2610.
              </li>
              <li>
                {status.auto_purge_scheduled
                  ? "Se eliminan solos el 22 de octubre a las 00:00 (hora de Mendoza)."
                  : "No hay eliminación automática programada."}
              </li>
              <li>Al borrarlos solo se eliminan los registros marcados como prueba. Tus clientes reales no se tocan.</li>
            </ul>
          </Card>

          {loaded ? (
            <Card className="flex flex-col gap-4 border-red-400/30">
              <SectionTitle>Eliminar ahora</SectionTitle>
              <p className="text-sm text-muted-foreground text-pretty">
                Borra todos los datos de prueba: clientes, vehículos, turnos, servicios, cobros y gastos ficticios.
              </p>
              <ConfirmAction
                action={purgeDemoData}
                fields={{}}
                triggerLabel="Eliminar datos de prueba"
                triggerClassName={`${dangerButtonClass} w-full sm:w-fit`}
                title="¿Eliminar los datos de prueba?"
                description={`Se borran ${status.clients} clientes, ${status.appointments} turnos, ${status.services} servicios y ${status.expenses} gastos de prueba. Tus datos reales no se tocan.`}
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-4">
              <SectionTitle>Generar datos de prueba</SectionTitle>
              <p className="text-sm text-muted-foreground text-pretty">
                Crea turnos aleatorios del mes actual y el siguiente: confirmados, por confirmar, cancelados, hechos,
                cobrados y sin cobrar. Suma clientes para recontactar, consultas y gastos.
              </p>
              <ActionForm action={seedDemoData} submitLabel="Generar datos de prueba">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="per_month" className={labelClass}>
                    Vehículos por mes
                  </label>
                  <input
                    id="per_month"
                    name="per_month"
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={300}
                    defaultValue={100}
                    className={`${fieldClass} text-base sm:max-w-40`}
                  />
                </div>
              </ActionForm>
            </Card>
          )}
        </>
      )}
    </>
  )
}
