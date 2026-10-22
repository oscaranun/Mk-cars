import { ZoneMapEditor } from "@/components/admin/zone-map-editor"
import type { Metadata } from "next"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin/auth"
import { todayArgentina } from "@/lib/admin/format"
import {
  WEEKDAYS,
  type Zone,
  type OperatingDay,
  type DayOverride,
  type MobileUnit,
  type ServiceType,
} from "@/lib/zones/types"
import { OperationResources, OperationSettingsFields } from "@/components/admin/operation-settings"
import { ActionForm } from "@/components/admin/action-form"
import { Card, Field, PageHeader, SectionTitle, fieldClass } from "@/components/admin/ui"
import { configureZones } from "./actions"

export const metadata: Metadata = { title: "Zonas y recorridos" }

function ZoneChoices({ zones, selected = [] }: { zones: Zone[]; selected?: string[] }) {
  return (
    <fieldset className="flex flex-wrap gap-3">
      <legend className="mb-2 text-xs text-muted-foreground">Zonas del recorrido</legend>
      {zones.map((z) => (
        <label key={z.id} className="flex gap-2 text-sm">
          <input type="checkbox" name="zone_ids" value={z.id} defaultChecked={selected.includes(z.id)} />
          {z.name}
          {!z.active && " (inactiva)"}
        </label>
      ))}
    </fieldset>
  )
}
function DayFields({ zones, value }: { zones: Zone[]; value?: OperatingDay | DayOverride }) {
  return (
    <>
      <ZoneChoices zones={zones} selected={value?.zone_ids} />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex gap-2">
          <input type="checkbox" name="enabled" defaultChecked={value?.enabled ?? true} />
          Jornada habilitada
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="flexible" defaultChecked={value?.flexible} />
          Flexible: todas las zonas activas
        </label>
      </div>
      <label className="text-xs">
        Cupo de vehículos para toda la jornada
        <input
          aria-label="Cupo diario de vehículos"
          type="number"
          name="capacity"
          min={1}
          max={30}
          defaultValue={value?.capacity ?? 4}
          className={fieldClass}
          required
        />
      </label>
    </>
  )
}
function ZoneForm({ zone }: { zone?: Zone }) {
  const suffix = zone?.id ?? "new"
  return (
    <ActionForm action={configureZones} submitLabel={zone ? "Guardar zona" : "Crear zona"}>
      <input type="hidden" name="kind" value="zone" />
      <input type="hidden" name="id" value={zone?.id ?? ""} />
      <Field label="Nombre" htmlFor={`zone-name-${suffix}`}>
        <input
          id={`zone-name-${suffix}`}
          name="name"
          defaultValue={zone?.name}
          className={fieldClass}
          minLength={2}
          maxLength={100}
          required
        />
      </Field>
      <Field label="Barrios (uno por línea o separados por comas)" htmlFor={`zone-neighborhoods-${suffix}`}>
        <textarea
          id={`zone-neighborhoods-${suffix}`}
          name="neighborhoods"
          defaultValue={zone?.neighborhoods.join("\n")}
          className={fieldClass}
        />
      </Field>
      <ZoneMapEditor initial={zone?.polygon ?? null} />
      <Field label="Prioridad (la mayor gana cuando se superponen zonas)" htmlFor={`zone-priority-${suffix}`}>
        <input
          id={`zone-priority-${suffix}`}
          type="number"
          name="priority"
          defaultValue={zone?.priority ?? 0}
          className={fieldClass}
        />
      </Field>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={zone?.active} />
        Zona activa
      </label>
    </ActionForm>
  )
}
export default async function ZonesPage() {
  const { supabase, isAdmin } = await requireAdmin()
  if (!isAdmin) return null
  const [zones, weekly, overrides, settings, units, services] = await Promise.all([
    supabase.from("operating_zones").select("*").order("name").returns<Zone[]>(),
    supabase.from("zone_weekly_schedule").select("*").order("weekday").returns<OperatingDay[]>(),
    supabase
      .from("zone_day_overrides")
      .select("*")
      .gte("day", todayArgentina())
      .order("day")
      .limit(90)
      .returns<DayOverride[]>(),
    supabase.from("zone_booking_settings").select("*").eq("id", 1).single(),
    supabase.from("mobile_units").select("*").order("name").returns<MobileUnit[]>(),
    supabase.from("zone_service_types").select("*").order("name").returns<ServiceType[]>(),
  ])
  if ([zones, weekly, overrides, settings, units, services].some((r) => r.error))
    return (
      <>
        <PageHeader title="Zonas y recorridos" />
        <Card>
          La configuración por zonas todavía no está disponible. Se necesita aprobar e instalar la migración 010 en la
          base correspondiente. El sistema actual sigue funcionando.
        </Card>
      </>
    )
  const all = zones.data ?? []
  return (
    <>
      <PageHeader
        title="Zonas y recorridos"
        description="Programación semanal, unidades móviles y capacidad sin modificar reservas existentes."
      />
      <Card className="flex flex-col gap-4">
        <SectionTitle>Activación del nuevo sistema</SectionTitle>
        <p className="text-sm text-muted-foreground">
          La modalidad actual se conserva hasta que habilites esta opción. Configurá primero zonas, polígonos y días.
          Los ejemplos iniciales están inactivos.
        </p>
        <ActionForm
          action={configureZones}
          submitLabel="Guardar modalidad"
          confirmText="¿Guardar la modalidad de reservas? Si la habilitás, el cliente elegirá día y el horario se coordinará después. Los datos existentes se conservan."
        >
          <input type="hidden" name="kind" value="settings" />
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={settings.data.enabled} />
            Habilitar reservas por zonas en la web
          </label>
          <OperationSettingsFields settings={settings.data} />
          <Field label="Días a mostrar hacia adelante" htmlFor="horizon">
            <input
              id="horizon"
              name="horizon_days"
              type="number"
              min={7}
              max={90}
              defaultValue={settings.data.horizon_days}
              className={fieldClass}
            />
          </Field>
        </ActionForm>
      </Card>
      <OperationResources units={units.data ?? []} services={services.data ?? []} />
      <SectionTitle>Zonas y barrios</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        {all.map((z) => (
          <Card key={z.id}>
            <ZoneForm zone={z} />
          </Card>
        ))}
        <Card>
          <SectionTitle>Nueva zona</SectionTitle>
          <ZoneForm />
        </Card>
      </div>
      <SectionTitle>Plantilla semanal</SectionTitle>
      <p className="text-sm text-muted-foreground">
        Los cambios no cancelan ni reprograman turnos. Revisá los confirmados y pendientes en Agenda de servicios antes
        de cambiar un recorrido.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {weekly.data?.map((day) => (
          <Card key={day.weekday}>
            <SectionTitle>{WEEKDAYS[day.weekday]}</SectionTitle>
            <ActionForm
              action={configureZones}
              submitLabel="Guardar día"
              confirmText="¿Cambiar la programación? Las reservas existentes conservarán su fecha y deberán revisarse manualmente."
            >
              <input type="hidden" name="kind" value="weekly" />
              <input type="hidden" name="weekday" value={day.weekday} />
              <DayFields zones={all} value={day} />
            </ActionForm>
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-4">
        <SectionTitle>Excepción o bloqueo de una fecha</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Los bloqueos de la agenda actual también se respetan. Para quitarlos, usá{" "}
          <Link href="/admin/agenda" className="underline">
            Agenda
          </Link>
          .
        </p>
        <ActionForm
          action={configureZones}
          submitLabel="Guardar excepción"
          confirmText="¿Guardar la excepción? Los turnos existentes no se cancelan. Revisalos en la agenda."
        >
          <input type="hidden" name="kind" value="override" />
          <Field label="Fecha" htmlFor="override-day">
            <input id="override-day" name="day" type="date" min={todayArgentina()} className={fieldClass} required />
          </Field>
          <DayFields zones={all} />
          <Field label="Motivo / nota (para bloquear, desmarcá Jornada habilitada)" htmlFor="override-reason">
            <input id="override-reason" name="reason" maxLength={200} className={fieldClass} />
          </Field>
        </ActionForm>
      </Card>
      {overrides.data?.map((day) => (
        <Card key={day.day}>
          <SectionTitle>
            {day.day} · {day.reason || "Excepción"}
          </SectionTitle>
          <ActionForm action={configureZones} submitLabel="Actualizar excepción">
            <input type="hidden" name="kind" value="override" />
            <input type="hidden" name="day" value={day.day} />
            <input type="hidden" name="reason" value={day.reason} />
            <DayFields zones={all} value={day} />
          </ActionForm>
        </Card>
      ))}
      <Card className="flex flex-col gap-4">
        <SectionTitle>Copiar programación de siete días</SectionTitle>
        <ActionForm action={configureZones} submitLabel="Copiar semana">
          <input type="hidden" name="kind" value="copy" />
          <Field label="Primer día origen (vacío para copiar la plantilla)" htmlFor="copy-source">
            <input id="copy-source" name="source" type="date" className={fieldClass} />
          </Field>
          <Field label="Primer día destino" htmlFor="copy-target">
            <input id="copy-target" name="target" type="date" min={todayArgentina()} required className={fieldClass} />
          </Field>
          <p className="text-sm text-muted-foreground">
            No se sobrescriben excepciones ni fechas con solicitudes o reservas.
          </p>
        </ActionForm>
      </Card>
    </>
  )
}
