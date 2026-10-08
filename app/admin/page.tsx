import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LogOut } from "lucide-react"
import { logout } from "@/app/admin/actions"
import { Logo } from "@/components/logo"
import { formatArgentinaDateTime } from "@/lib/booking"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Panel — MK Cars",
  robots: { index: false, follow: false },
}

const STATUS_LABELS: Record<string, string> = {
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
  reprogramado: "Reprogramado",
  cancelado: "Cancelado",
  realizado: "Realizado",
}

type PendingAppointment = {
  id: string
  requested_start: string
  address: string
  service: string
  status: string
  clients: { full_name: string; whatsapp: string } | null
}

export default async function AdminPage() {
  const supabase = await createClient()
  if (!supabase) redirect("/admin/login")

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/admin/login")

  const { data: isAdmin } = await supabase.rpc("is_admin")

  const header = (
    <header className="flex items-center justify-between gap-4">
      <Logo />
      <form action={logout}>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Salir
        </button>
      </form>
    </header>
  )

  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-5 py-6 md:px-8">
        {header}
        <p role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Tu usuario no tiene permisos de administrador.
        </p>
      </main>
    )
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [inquiries, clients, requested, confirmed, pending] = await Promise.all([
    supabase.from("inquiries").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "solicitado"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "confirmado"),
    supabase
      .from("appointments")
      .select("id, requested_start, address, service, status, clients(full_name, whatsapp)")
      .eq("status", "solicitado")
      .order("requested_start", { ascending: true })
      .limit(20)
      .returns<PendingAppointment[]>(),
  ])

  const stats = [
    { label: "Consultas (30 días)", value: inquiries.count ?? 0 },
    { label: "Clientes nuevos (30 días)", value: clients.count ?? 0 },
    { label: "Turnos por confirmar", value: requested.count ?? 0 },
    { label: "Turnos confirmados", value: confirmed.count ?? 0 },
  ]

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-5 py-6 md:px-8">
      {header}
      <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-4 shadow-soft">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Solicitudes pendientes</h2>
        {pending.data?.length ? (
          <ul className="flex flex-col gap-2">
            {pending.data.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{a.clients?.full_name ?? "Cliente"}</span>
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground">
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatArgentinaDateTime(a.requested_start)} · {a.service}
                </span>
                <span className="text-sm text-muted-foreground">{a.address}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No hay solicitudes pendientes.
          </p>
        )}
      </section>
    </main>
  )
}
