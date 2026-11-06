import type { Metadata } from "next"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin/auth"
import { createTask, deleteTask, toggleTask } from "@/app/admin/(panel)/pro-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, EmptyState, Field, PageHeader, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatDate, todayArgentina } from "@/lib/admin/format"

export const metadata: Metadata = { title: "Tareas" }

type Task = {
  id: string
  title: string
  due_on: string
  done_at: string | null
  created_by_email: string | null
  clients: { id: string; full_name: string | null } | null
}

function TaskItem({ t, today }: { t: Task; today: string }) {
  const overdue = !t.done_at && t.due_on < today
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/60 p-3">
      <ActionForm action={toggleTask} submitLabel={t.done_at ? "Reabrir" : "Hecha"} submitClassName={secondaryButtonClass}>
        <input type="hidden" name="task_id" value={t.id} />
        <input type="hidden" name="done" value={t.done_at ? "0" : "1"} />
      </ActionForm>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className={t.done_at ? "text-muted-foreground line-through" : "font-medium"}>{t.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(t.due_on)}
          {t.clients && (
            <>
              {" · "}
              <Link href={`/admin/clientes/${t.clients.id}`} className="text-electric hover:underline">
                {t.clients.full_name}
              </Link>
            </>
          )}
        </p>
      </div>
      {overdue && <Badge tone="danger">Vencida</Badge>}
      {t.due_on === today && !t.done_at && <Badge tone="warning">Hoy</Badge>}
      <ActionForm action={deleteTask} submitLabel="Borrar" submitClassName={secondaryButtonClass} confirmText="¿Borrar esta tarea?">
        <input type="hidden" name="task_id" value={t.id} />
      </ActionForm>
    </li>
  )
}

export default async function TareasPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams
  const { supabase } = await requireAdmin()
  const today = todayArgentina()
  const [{ data: open }, { data: done }] = await Promise.all([
    supabase.from("admin_tasks").select("id, title, due_on, done_at, created_by_email, clients(id, full_name)").is("done_at", null).order("due_on").limit(200),
    supabase.from("admin_tasks").select("id, title, due_on, done_at, created_by_email, clients(id, full_name)").not("done_at", "is", null).order("done_at", { ascending: false }).limit(20),
  ])

  return (
    <>
      <PageHeader title="Tareas" description="Recordatorios con fecha. Las de hoy y las vencidas aparecen también en Hoy." />
      <Card>
        <ActionForm action={createTask} submitLabel="Agregar tarea" inline resetOnSuccess>
          {cliente && <input type="hidden" name="client_id" value={cliente} />}
          <Field label="Tarea" htmlFor="title" className="min-w-64 flex-1">
            <input id="title" name="title" required maxLength={200} placeholder="Llamar a Juan por el presupuesto" className={fieldClass} />
          </Field>
          <Field label="Fecha" htmlFor="due_on">
            <input id="due_on" name="due_on" type="date" required defaultValue={today} className={fieldClass} />
          </Field>
        </ActionForm>
      </Card>
      <section className="flex flex-col gap-3">
        <SectionTitle>Pendientes</SectionTitle>
        {(open ?? []).length === 0 ? (
          <EmptyState>No hay tareas pendientes.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {((open ?? []) as unknown as Task[]).map((t) => (
              <TaskItem key={t.id} t={t} today={today} />
            ))}
          </ul>
        )}
      </section>
      {(done ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Completadas recientemente</SectionTitle>
          <ul className="flex flex-col gap-2">
            {((done ?? []) as unknown as Task[]).map((t) => (
              <TaskItem key={t.id} t={t} today={today} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
