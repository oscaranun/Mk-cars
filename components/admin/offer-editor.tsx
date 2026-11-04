"use client"

import { useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { saveOffer } from "@/app/admin/(panel)/offer-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Field, fieldClass, secondaryButtonClass } from "@/components/admin/ui"

type Slot = { key: number; date: string; time: string; duration: number }

const inputClass = `${fieldClass} text-base md:text-sm`

export function OfferEditor({
  appointmentId,
  today,
  defaults,
}: {
  appointmentId: string
  today: string
  defaults: {
    service: string
    total: number | ""
    discount: number
    conditions: string
    duration: number
    slots: { date: string; time: string; duration: number }[]
  }
}) {
  const nextKey = useRef(1)
  const [slots, setSlots] = useState<Slot[]>(() =>
    defaults.slots.length
      ? defaults.slots.map((s) => ({ key: nextKey.current++, ...s }))
      : [{ key: nextKey.current++, date: "", time: "", duration: defaults.duration }],
  )

  const update = (key: number, patch: Partial<Slot>) => setSlots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  return (
    <ActionForm action={saveOffer} submitLabel="Guardar propuesta">
      <input type="hidden" name="appointment_id" value={appointmentId} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Horarios que le ofrecés</legend>
        {slots.map((slot, i) => (
          <div key={slot.key} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-2xl bg-surface p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label={`Opción ${i + 1} · día`} htmlFor={`slot-date-${slot.key}`}>
                <input
                  id={`slot-date-${slot.key}`}
                  name="slot_date"
                  type="date"
                  required
                  min={today}
                  value={slot.date}
                  onChange={(e) => update(slot.key, { date: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Hora" htmlFor={`slot-time-${slot.key}`}>
                <input
                  id={`slot-time-${slot.key}`}
                  name="slot_time"
                  type="time"
                  required
                  step={900}
                  value={slot.time}
                  onChange={(e) => update(slot.key, { time: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Duración (min)" htmlFor={`slot-duration-${slot.key}`} className="col-span-2 sm:col-span-1">
                <input
                  id={`slot-duration-${slot.key}`}
                  name="slot_duration"
                  type="number"
                  min={15}
                  max={540}
                  step={15}
                  required
                  value={slot.duration}
                  onChange={(e) => update(slot.key, { duration: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => setSlots((list) => list.filter((s) => s.key !== slot.key))}
              disabled={slots.length === 1}
              aria-label={`Quitar opción ${i + 1}`}
              className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        {slots.length < 6 && (
          <button
            type="button"
            onClick={() =>
              setSlots((list) => [...list, { key: nextKey.current++, date: "", time: "", duration: list.at(-1)?.duration ?? defaults.duration }])
            }
            className={`${secondaryButtonClass} w-fit`}
          >
            <Plus className="size-4" aria-hidden="true" />
            Agregar otro horario
          </button>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Servicio" htmlFor="offer-service" className="sm:col-span-2">
          <input id="offer-service" name="service" required minLength={2} maxLength={200} defaultValue={defaults.service} className={inputClass} />
        </Field>
        <Field label="Importe total" htmlFor="offer-total">
          <input id="offer-total" name="total" inputMode="decimal" required placeholder="Ej.: 25000" defaultValue={defaults.total} className={inputClass} />
        </Field>
        <Field label="Descuento" htmlFor="offer-discount">
          <input id="offer-discount" name="discount" inputMode="decimal" placeholder="0" defaultValue={defaults.discount || ""} className={inputClass} />
        </Field>
        <Field label="Condiciones para el cliente (opcional)" htmlFor="offer-conditions" className="sm:col-span-2">
          <textarea
            id="offer-conditions"
            name="conditions"
            rows={3}
            maxLength={2000}
            defaultValue={defaults.conditions}
            placeholder="Ej.: el pago se hace por transferencia una vez confirmado el turno."
            className={`${inputClass} py-2.5`}
          />
        </Field>
      </div>
    </ActionForm>
  )
}
