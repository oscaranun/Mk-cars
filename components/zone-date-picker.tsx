"use client"

import { useEffect, useState } from "react"
import type { Point } from "@/lib/zones/geometry"
import type { ZoneAvailability } from "@/lib/zones/types"

export function ZoneDatePicker({
  point,
  vehicles,
  fieldClass,
  serviceId,
}: {
  point: Point | null
  vehicles: number
  fieldClass: string
  serviceId: string
}) {
  const [result, setResult] = useState<ZoneAvailability | null>(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState("")
  useEffect(() => {
    setResult(null)
    setSelected("")
    setError("")
    if (!point || !serviceId) return
    const controller = new AbortController()
    fetch(`/api/zone-availability?lat=${point.lat}&lng=${point.lng}&vehicles=${vehicles}&service=${serviceId}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("No pudimos consultar los días disponibles. Volvé a seleccionar tu dirección.")
        return r.json()
      })
      .then(setResult)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [point, vehicles, serviceId])
  const full = result?.dates.find((d) => d.day === selected)?.full
  return (
    <div className="flex flex-col gap-3 md:col-span-2" aria-live="polite">
      <p className="text-sm text-muted-foreground">
        Elegí el día que visitamos tu zona. Nosotros organizamos el recorrido y te proponemos el mejor horario
        disponible.
      </p>
      {!point && <p className="text-sm">Primero elegí tu dirección de la lista de Google Maps.</p>}
      {point && !result && !error && <p className="text-sm">Consultando días disponibles…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-200">
          {error}
        </p>
      )}
      {result && !result.enabled && <p role="alert">La programación cambió. Recargá la página para continuar.</p>}
      {result?.manual && (
        <p className="text-sm">
          Tu dirección está dentro de la cobertura y requiere revisión de zona. Enviá la solicitud y coordinaremos el
          día por WhatsApp.
        </p>
      )}
      {result?.zone && (
        <>
          <p className="text-sm font-medium">Zona: {result.zone.name}</p>
          <label htmlFor="zone-date" className="text-sm font-medium">
            Día del servicio *
          </label>
          <select
            id="zone-date"
            name="date"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className={fieldClass}
            required
          >
            <option value="">Elegí un día</option>
            {result.dates.map((d) => (
              <option key={d.day} value={d.day}>
                {new Date(`${d.day}T12:00:00-03:00`).toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                · {d.full ? "Completo · lista de espera" : `${d.remaining} cupos`}
              </option>
            ))}
          </select>
          {!result.dates.length && <p>No hay días programados para esta zona. Consultanos por WhatsApp.</p>}
          {full && (
            <label className="flex gap-3 text-sm">
              <input name="waitlist" type="checkbox" required />
              Quiero sumarme a la lista de espera. Esto no confirma una reserva.
            </label>
          )}
        </>
      )}
      <input
        type="hidden"
        name="zoneAvailabilityReady"
        value={result?.enabled && (result.manual || selected) ? "yes" : ""}
      />
    </div>
  )
}
