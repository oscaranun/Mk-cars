import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/admin/ui"
import {
  AgendaSection,
  InquiriesSection,
  PendingSection,
  UnpaidSection,
  type AgendaAppt,
  type OpenInquiry,
  type PendingAppt,
  type UnpaidService,
} from "@/components/admin/today-sections"
import { requireAdmin } from "@/lib/admin/auth"
import { addDays, formatDateTime, startOfArgentinaDay, todayArgentina } from "@/lib/admin/format"
import { PENDING_APPOINTMENT_STATUSES } from "@/lib/admin/labels"
import { longDate } from "@/lib/admin/whatsapp-messages"

export const metadata: Metadata = { title: "Hoy" }

export default async function AdminTodayPage() {
  const { supabase } = await requireAdmin()
  const now = Date.now()
  const today = todayArgentina()

  const [pending, agenda, inquiries, unpaid, tasks] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, requested_start, address, service, status, created_at, updated_at, contact_name, clients(full_name, whatsapp)")
      .in("status", PENDING_APPOINTMENT_STATUSES)
      .order("created_at", { ascending: true })
      .limit(50)
      .returns<PendingAppt[]>(),
    supabase
      .from("appointments")
      .select("id, confirmed_start, duration_minutes, address, service, status, contact_name, clients(full_name, whatsapp)")
      .in("status", ["confirmado", "realizado"])
      .gte("confirmed_start", startOfArgentinaDay(today))
      .lt("confirmed_start", startOfArgentinaDay(addDays(today, 1)))
      .order("confirmed_start", { ascending: true })
      .returns<AgendaAppt[]>(),
    supabase
      .from("inquiries")
      .select("id, created_at, service, commercial_status, clients(full_name, whatsapp)")
      .in("commercial_status", ["nueva", "pendiente_respuesta"])
      .order("created_at", { ascending: true })
      .limit(20)
      .returns<OpenInquiry[]>(),
    supabase
      .from("services")
      .select("id, performed_at, wash_type, final_price, amount_paid, clients(id, full_name)")
      .neq("payment_status", "cobrado")
      .order("performed_at", { ascending: true })
      .limit(20)
      .returns<UnpaidService[]>(),
    supabase
      .from("admin_tasks")
      .select("id, title, due_on")
      .is("done_at", null)
      .lte("due_on", today)
      .order("due_on")
      .limit(20),
  ])
  const dueTasks = (tasks.data ?? []) as { id: string; title: string; due_on: string }[]

  return (
    <>
      <PageHeader
        title="Hoy"
        description={`${longDate(new Date(now).toISOString())} · actualizado ${formatDateTime(new Date(now))}`}
        actions={
          <Link
            href="/admin/turnos/nuevo"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nuevo turno
          </Link>
        }
      />

      {dueTasks.length > 0 && (
        <section aria-labelledby="hoy-tareas" className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="hoy-tareas" className="text-sm font-semibold">
              Tareas para hoy ({dueTasks.length})
            </h2>
          </div>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {dueTasks.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span>{t.title}</span>
                <span className={t.due_on < today ? "text-destructive" : "text-muted-foreground"}>
                  {t.due_on < today ? "Vencida" : "Hoy"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PendingSection items={pending.data ?? []} now={now} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AgendaSection items={agenda.data ?? []} />
        <div className="flex flex-col gap-6">
          <InquiriesSection items={inquiries.data ?? []} />
          <UnpaidSection items={unpaid.data ?? []} />
        </div>
      </div>
    </>
  )
}
