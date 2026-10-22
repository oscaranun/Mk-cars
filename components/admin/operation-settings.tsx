import { ActionForm } from "@/components/admin/action-form"
import { Card, Field, SectionTitle, fieldClass } from "@/components/admin/ui"
import { configureZones } from "@/app/admin/(panel)/zonas/actions"
import type { MobileUnit, ServiceType, ZoneSettings } from "@/lib/zones/types"

export function OperationSettingsFields({ settings: s }: { settings: ZoneSettings }) {
  return (
    <>
      <input type="hidden" name="minutes_per_vehicle" value={s.minutes_per_vehicle} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Inicio de jornada" htmlFor="day-start">
          <input
            id="day-start"
            name="day_start"
            type="time"
            defaultValue={s.day_start.slice(0, 5)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Fin de jornada" htmlFor="day-end">
          <input
            id="day-end"
            name="day_end"
            type="time"
            defaultValue={s.day_end.slice(0, 5)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Inicio de pausa (opcional)" htmlFor="pause-start">
          <input
            id="pause-start"
            name="pause_start"
            type="time"
            defaultValue={s.pause_start?.slice(0, 5) ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="Fin de pausa" htmlFor="pause-end">
          <input
            id="pause-end"
            name="pause_end"
            type="time"
            defaultValue={s.pause_end?.slice(0, 5) ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="Traslado entre domicilios (minutos)" htmlFor="travel">
          <input
            id="travel"
            name="travel_minutes"
            type="number"
            min={0}
            max={240}
            defaultValue={s.travel_minutes}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Margen adicional entre turnos (minutos)" htmlFor="buffer">
          <input
            id="buffer"
            name="buffer_minutes"
            type="number"
            min={0}
            max={120}
            defaultValue={s.buffer_minutes}
            className={fieldClass}
            required
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        El traslado es una estimación editable, sin tráfico calculado. La pausa aplica a todas las unidades. Los cambios
        se rechazan si dejan fuera de jornada o en pausa un turno confirmado futuro.
      </p>
    </>
  )
}

export function OperationResources({ units, services }: { units: MobileUnit[]; services: ServiceType[] }) {
  return (
    <>
      <SectionTitle>Unidades móviles · {units.filter((u) => u.active).length} activas</SectionTitle>
      <p className="text-sm text-muted-foreground">
        Agregá o desactivá unidades para cambiar la cantidad disponible. La Partner principal representa también los
        turnos históricos sin unidad asignada. No se desactivan unidades con turnos o propuestas pendientes.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {[...units, undefined].map((u) => (
          <Card key={u?.id ?? "new-unit"}>
            <ResourceForm kind="unit" item={u} />
          </Card>
        ))}
      </div>
      <SectionTitle>Servicios y duración por vehículo</SectionTitle>
      <p className="text-sm text-muted-foreground">
        La duración determina la disponibilidad de los días y sugiere la duración total del turno. Editarla conserva la
        estimación registrada en solicitudes anteriores.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {[...services, undefined].map((s) => (
          <Card key={s?.id ?? "new-service"}>
            <ResourceForm kind="service" item={s} />
          </Card>
        ))}
      </div>
    </>
  )
}
function ResourceForm({ kind, item }: { kind: "unit" | "service"; item?: MobileUnit | ServiceType }) {
  const suffix = item ? `${kind}-${item.id}` : `new-${kind}`
  return (
    <ActionForm
      action={configureZones}
      submitLabel={item ? "Guardar cambios" : kind === "unit" ? "Agregar unidad" : "Agregar servicio"}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <Field label={kind === "unit" ? "Nombre de la unidad" : "Nombre del servicio"} htmlFor={`resource-${suffix}`}>
        <input
          id={`resource-${suffix}`}
          name="name"
          defaultValue={item?.name}
          minLength={2}
          maxLength={100}
          className={fieldClass}
          required
        />
      </Field>
      {kind === "service" && (
        <Field label="Duración por vehículo (minutos)" htmlFor={`resource-minutes-${suffix}`}>
          <input
            id={`resource-minutes-${suffix}`}
            name="minutes_per_vehicle"
            type="number"
            min={15}
            max={540}
            defaultValue={item && "minutes_per_vehicle" in item ? item.minutes_per_vehicle : 90}
            className={fieldClass}
            required
          />
        </Field>
      )}
      <label className="flex gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={item?.active ?? true} />
        {kind === "unit" ? "Unidad activa" : "Servicio disponible en la web"}
      </label>
    </ActionForm>
  )
}
