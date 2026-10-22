"use client"

import { useEffect, useRef, useState } from "react"
import { loadGoogleLibrary } from "@/lib/google-maps"
import { COVERAGE_BOUNDS, COVERAGE_POLYGON } from "@/lib/coverage"
import type { Ring } from "@/lib/zones/geometry"
import { secondaryButtonClass } from "@/components/admin/ui"

export function ZoneMapEditor({ initial }: { initial: Ring | null }) {
  const host = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polygon = useRef<any>(null)
  const [ring, setRing] = useState<Ring | null>(initial)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const listeners: { remove: () => void }[] = []
    loadGoogleLibrary("maps")
      .then((maps) => {
        if (cancelled || !host.current) return
        const map = new maps.Map(host.current, {
          center: {
            lat: (COVERAGE_BOUNDS.north + COVERAGE_BOUNDS.south) / 2,
            lng: (COVERAGE_BOUNDS.west + COVERAGE_BOUNDS.east) / 2,
          },
          zoom: 11,
          streetViewControl: false,
          mapTypeControl: false,
        })
        new maps.Polygon({
          map,
          paths: COVERAGE_POLYGON.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: "#38bdf8",
          strokeWeight: 1,
          fillOpacity: 0.06,
          clickable: false,
        })
        const paths = initial?.slice(0, -1).map(([lng, lat]) => ({ lat, lng })) ?? []
        const drawn = new maps.Polygon({
          map,
          paths,
          editable: true,
          strokeColor: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.2,
        })
        polygon.current = drawn
        const path = drawn.getPath()
        const update = () => {
          const points: Ring = path.getArray().map((p: { lng: () => number; lat: () => number }) => [p.lng(), p.lat()])
          setRing(points.length >= 3 ? [...points, points[0]] : null)
        }
        listeners.push(map.addListener("click", (event: { latLng: unknown }) => path.push(event.latLng)))
        for (const event of ["insert_at", "set_at", "remove_at"]) listeners.push(path.addListener(event, update))
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
      listeners.forEach((l) => l.remove())
      polygon.current?.setMap(null)
      polygon.current = null
    }
    // Reopen a zone form after saving to edit its persisted geometry.
  }, [initial, editing])
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Límite de la zona</p>
      <p className="text-xs text-muted-foreground">
        Marcá al menos tres puntos en el mapa y arrastrá los vértices para ajustar. El contorno celeste muestra la
        cobertura actual y siempre limita el servicio.
      </p>
      {!editing ? (
        <button type="button" className={secondaryButtonClass} onClick={() => setEditing(true)}>
          Editar límite en el mapa
        </button>
      ) : (
        <div ref={host} aria-label="Mapa para delimitar la zona" className="h-72 rounded-2xl border border-border" />
      )}
      {error && (
        <p role="alert" className="text-sm text-red-200">
          {error} El límite guardado se conserva.
        </p>
      )}
      {editing && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              const p = polygon.current?.getPath()
              if (p?.getLength()) p.removeAt(p.getLength() - 1)
            }}
          >
            Deshacer último punto
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => {
              polygon.current?.getPath().clear()
              setRing(null)
            }}
          >
            Limpiar límite
          </button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {ring ? `${ring.length - 1} puntos definidos` : "Zona sin límite definido. No se puede activar todavía."}
      </p>
      <input type="hidden" name="polygon" value={ring ? JSON.stringify(ring) : ""} />
    </div>
  )
}
