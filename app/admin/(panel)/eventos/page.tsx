import type { Metadata } from "next"
import type { ReactNode } from "react"
import { requireAdmin } from "@/lib/admin/auth"
import { createEvent, updateEvent } from "@/app/admin/(panel)/event-actions"
import { ActionForm } from "@/components/admin/action-form"
import { EventLinkShare } from "@/components/admin/event-link-share"
import { Badge, Card, EmptyState, Field, PageHeader, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { todayArgentina } from "@/lib/admin/format"
import { formatEventDate, isEventOver, type EventFlyer } from "@/lib/events"
import { SITE_URL } from "@/lib/seo"

export const metadata: Metadata = { title: "Flyers de eventos" }

function EventFields({ event }: { event?: EventFlyer }): ReactNode {
  const id = event?.id ?? "new"
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Título del flyer" htmlFor={`title-${id}`} className="md:col-span-2">
        <input
          id={`title-${id}`}
          name="title"
          required
          maxLength={120}
          defaultValue={event?.title}
          placeholder="Este sábado estamos en Palmares"
          className={fieldClass}
        />
      </Field>
      <Field label="Fecha del evento (opcional)" htmlFor={`date-${id}`}>
        <input id={`date-${id}`} name="event_date" type="date" defaultValue={event?.event_date ?? ""} className={fieldClass} />
      </Field>
      <Field label="Lugar (opcional)" htmlFor={`place-${id}`}>
        <input id={`place-${id}`} name="place" maxLength={120} defaultValue={event?.place ?? ""} placeholder="Palmares Open Mall" className={fieldClass} />
      </Field>
      <Field label="Texto corto (opcional)" htmlFor={`desc-${id}`} className="md:col-span-2">
        <textarea
          id={`desc-${id}`}
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={event?.description ?? ""}
          placeholder="Reservá tu turno y lavamos tu auto mientras hacés tus compras."
          className={fieldClass}
        />
      </Field>
      <Field label="Texto del botón" htmlFor={`button-${id}`}>
        <input id={`button-${id}`} name="button_label" maxLength={40} defaultValue={event?.button_label ?? "Reservá tu turno"} className={fieldClass} />
      </Field>
      <Field label="Vence (opcional, si no usa la fecha del evento)" htmlFor={`ends-${id}`}>
        <input id={`ends-${id}`} name="ends_on" type="date" defaultValue={event?.ends_on ?? ""} className={fieldClass} />
      </Field>
    </div>
  )
}

export default async function EventosPage() {
  const { supabase } = await requireAdmin()
  const today = todayArgentina()
  const { data } = await supabase
    .from("events")
    .select("id, slug, title, event_date, place, description, button_label, ends_on, active")
    .order("created_at", { ascending: false })
  const events = (data ?? []) as EventFlyer[]

  const slugs = events.map((e) => `evento:${e.slug}`)
  const { data: inquiries } = slugs.length
    ? await supabase.from("inquiries").select("origen_reserva").in("origen_reserva", slugs)
    : { data: [] as { origen_reserva: string | null }[] }
  const bookings = new Map<string, number>()
  for (const i of inquiries ?? []) bookings.set(i.origen_reserva!, (bookings.get(i.origen_reserva!) ?? 0) + 1)

  return (
    <>
      <PageHeader
        title="Flyers de eventos"
        description="Armá un flyer con su propio link para cada evento. Las reservas que lleguen desde ahí quedan marcadas con el evento."
      />

      <Card className="flex flex-col gap-4">
        <SectionTitle>Nuevo flyer</SectionTitle>
        <ActionForm action={createEvent} submitLabel="Crear flyer" resetOnSuccess>
          <EventFields />
          <Field label="Link (opcional, se arma solo con el título)" htmlFor="slug-new">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">mkcars.com.ar/evento/</span>
              <input id="slug-new" name="slug" maxLength={60} placeholder="palmares" className={fieldClass} />
            </div>
          </Field>
        </ActionForm>
      </Card>

      <section className="flex flex-col gap-4" aria-labelledby="eventos-lista">
        <h2 id="eventos-lista" className="text-lg font-semibold">
          Tus flyers
        </h2>
        {events.length === 0 ? (
          <EmptyState>Todavía no creaste flyers de eventos.</EmptyState>
        ) : (
          events.map((e) => {
            const over = isEventOver(e, today)
            const link = `${SITE_URL}/evento/${e.slug}`
            const when = [formatEventDate(e.event_date), e.place].filter(Boolean).join(" · ")
            const count = bookings.get(`evento:${e.slug}`) ?? 0
            return (
              <Card key={e.id} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-semibold">{e.title}</p>
                    {when && <p className="text-sm text-muted-foreground">{when}</p>}
                    <p className="text-xs text-muted-foreground">
                      {count} {count === 1 ? "reserva" : "reservas"} desde este flyer
                    </p>
                  </div>
                  {!e.active ? <Badge>Desactivado</Badge> : over ? <Badge tone="warning">Finalizado</Badge> : <Badge tone="success">Activo</Badge>}
                </div>

                <EventLinkShare
                  link={link}
                  message={[e.title, when, e.button_label ? `${e.button_label} acá:` : ""].filter(Boolean).join("\n")}
                />

                <details className="rounded-2xl border border-border p-4">
                  <summary className="cursor-pointer text-sm font-medium">Editar flyer</summary>
                  <div className="mt-4 flex flex-col gap-4">
                    <ActionForm action={updateEvent} submitLabel="Guardar cambios">
                      <input type="hidden" name="event_id" value={e.id} />
                      <EventFields event={e} />
                    </ActionForm>
                  </div>
                </details>

                <div className="flex flex-wrap gap-2">
                  <ActionForm action={updateEvent} submitLabel={e.active ? "Desactivar" : "Activar"} submitClassName={secondaryButtonClass}>
                    <input type="hidden" name="event_id" value={e.id} />
                    <input type="hidden" name="op" value="toggle" />
                  </ActionForm>
                  <ActionForm action={updateEvent} submitLabel="Eliminar" submitClassName={secondaryButtonClass}>
                    <input type="hidden" name="event_id" value={e.id} />
                    <input type="hidden" name="op" value="delete" />
                  </ActionForm>
                </div>
              </Card>
            )
          })
        )}
      </section>
    </>
  )
}
