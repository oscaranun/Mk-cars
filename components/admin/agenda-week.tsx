import Link from "next/link"
import { Ban } from "lucide-react"
import { blockDate, unblockDate } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, Field, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatTime } from "@/lib/admin/format"
import { APPOINTMENT_STATUS, appointmentTone } from "@/lib/admin/labels"
import { formatDuration } from "@/lib/admin/whatsapp-messages"
import { cn } from "@/lib/utils"

export type AgendaItem = {
  id: string
  start: string
  day: string
  duration: number
  name: string
  address: string
  status: string
}

function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00Z`)
  const weekday = d.toLocaleDateString("es-AR", { weekday: "short", timeZone: "UTC" })
  return { weekday: weekday.replace(".", ""), day: d.getUTCDate(), month: d.toLocaleDateString("es-AR", { month: "short", timeZone: "UTC" }) }
}

const isPending = (status: string) => status !== "confirmado" && status !== "realizado"

export function WeekGrid({
  days,
  today,
  items,
  blocked,
}: {
  days: string[]
  today: string
  items: AgendaItem[]
  blocked: Record<string, string>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {days.map((day) => {
        const label = dayLabel(day)
        const dayItems = items.filter((i) => i.day === day)
        const isBlocked = day in blocked
        const busyMinutes = dayItems.filter((i) => !isPending(i.status)).reduce((sum, i) => sum + i.duration, 0)
        return (
          <section
            key={day}
            aria-label={`${label.weekday} ${label.day}`}
            className={cn(
              "flex min-h-40 flex-col gap-2 rounded-3xl border bg-card p-3 shadow-soft",
              day === today ? "border-primary/60" : "border-border",
              isBlocked && "bg-red-500/5",
            )}
          >
            <header className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium uppercase text-muted-foreground">{label.weekday}</span>
                <span className={cn("text-lg font-semibold tabular-nums", day === today && "text-electric")}>{label.day}</span>
                <span className="text-xs text-muted-foreground">{label.month}</span>
              </div>
              {busyMinutes > 0 && <span className="text-xs tabular-nums text-muted-foreground">{formatDuration(busyMinutes)}</span>}
            </header>

            {isBlocked && (
              <div className="flex flex-col gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 p-2.5 text-xs text-red-200">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Ban className="size-3.5" aria-hidden="true" />
                  Bloqueado{blocked[day] ? `: ${blocked[day]}` : ""}
                </span>
                <ActionForm action={unblockDate} submitLabel="Desbloquear" submitClassName={cn(secondaryButtonClass, "min-h-8 px-3 text-xs")}>
                  <input type="hidden" name="day" value={day} />
                </ActionForm>
              </div>
            )}

            {dayItems.length ? (
              <ul className="flex flex-col gap-2">
                {dayItems.map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/admin/turnos/${i.id}`}
                      className={cn(
                        "flex flex-col gap-1 rounded-2xl border bg-surface p-2.5 text-sm transition hover:border-electric/60",
                        isPending(i.status) ? "border-dashed border-amber-300/50" : "border-border",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold tabular-nums">{formatTime(i.start)}</span>
                        <Badge tone={appointmentTone(i.status)}>{APPOINTMENT_STATUS[i.status] ?? i.status}</Badge>
                      </span>
                      <span className="font-medium">{i.name}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{i.address}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              !isBlocked && <p className="text-xs text-muted-foreground">Libre</p>
            )}
          </section>
        )
      })}
    </div>
  )
}

export function BlockDateForm({ today }: { today: string }) {
  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle>Bloquear un día</SectionTitle>
      <p className="text-sm text-muted-foreground text-pretty">
        Feriados, lluvia o vacaciones. La web no va a aceptar reservas para ese día. Los turnos ya cargados no se modifican.
      </p>
      <ActionForm action={blockDate} submitLabel="Bloquear día" inline resetOnSuccess>
        <Field label="Fecha" htmlFor="block-day">
          <input id="block-day" name="day" type="date" min={today} required className={fieldClass} />
        </Field>
        <Field label="Motivo (opcional)" htmlFor="block-reason" className="min-w-56 flex-1">
          <input id="block-reason" name="reason" type="text" maxLength={120} placeholder="Ej: Feriado" className={fieldClass} />
        </Field>
      </ActionForm>
    </Card>
  )
}
