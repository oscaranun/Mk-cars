import type { ReactNode } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { LogOut } from "lucide-react"
import { SECTIONS, USERS_SECTION, allowedKeys, canAccess, sectionForPath } from "@/lib/admin/permissions"
import { logout } from "@/app/admin/actions"
import { AdminNav } from "@/components/admin/admin-nav"
import { GlobalSearch } from "@/components/admin/global-search"
import { Logo } from "@/components/logo"
import { requireAdmin } from "@/lib/admin/auth"
import { PENDING_APPOINTMENT_STATUSES } from "@/lib/admin/labels"

export const metadata: Metadata = {
  title: { default: "Panel — MK Cars", template: "%s — Panel MK Cars" },
  robots: { index: false, follow: false },
}

function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Salir
      </button>
    </form>
  )
}

function NoAccess({ allowed }: { allowed: string[] }) {
  const links = [...SECTIONS, USERS_SECTION].filter((s) => !("hidden" in s && s.hidden) && allowed.includes(s.key))
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
      <p>No tenés permiso para ver esta sección. Pedile acceso al propietario del panel.</p>
      {links.length > 0 && (
        <Link href={links[0].href} className="w-fit font-medium text-electric underline-offset-4 hover:underline">
          Ir a {links[0].label}
        </Link>
      )}
    </div>
  )
}

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"]

async function navCounts(supabase: Supabase, allowed: string[]): Promise<Record<string, number>> {
  const ar = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
  const today = ar.format(new Date())
  const dayStart = `${today}T00:00:00-03:00`
  const dayEnd = `${today}T23:59:59-03:00`
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0

  const [requests, newInquiries, todays, followUps] = await Promise.all([
    allowed.includes("consultas")
      ? count(supabase.from("appointments").select("id", { count: "exact", head: true }).in("status", PENDING_APPOINTMENT_STATUSES))
      : 0,
    allowed.includes("consultas")
      ? count(
          supabase
            .from("inquiries")
            .select("id", { count: "exact", head: true })
            .in("commercial_status", ["nueva", "pendiente_respuesta"]),
        )
      : 0,
    allowed.includes("hoy")
      ? count(
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("status", "confirmado")
            .gte("confirmed_start", dayStart)
            .lte("confirmed_start", dayEnd),
        )
      : 0,
    allowed.includes("recontactar")
      ? count(
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .is("archived_at", null)
            .lte("follow_up_at", today),
        )
      : 0,
  ])
  return { consultas: requests + newInquiries, hoy: todays, recontactar: followUps }
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, profile, supabase } = await requireAdmin()
  const pathname = (await headers()).get("x-pathname") ?? "/admin"
  const allowed = allowedKeys(profile)
  const permitted = canAccess(profile, sectionForPath(pathname))
  const counts = isAdmin ? await navCounts(supabase, allowed) : {}

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="flex flex-col gap-4 border-b border-border bg-deep/60 px-4 pb-3 pt-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-center">
          <Logo className="w-[110px] md:w-[110px] lg:w-[170px]" />
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>
        {isAdmin && <GlobalSearch />}
        {isAdmin && <AdminNav allowed={allowed} counts={counts} />}
        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          <div className="flex min-w-0 flex-col">
            {profile?.full_name?.trim() && (
              <p className="truncate text-sm font-semibold uppercase tracking-wide text-foreground">{profile.full_name.trim()}</p>
            )}
            <p className="truncate text-xs text-muted-foreground" title={user.email ?? undefined}>
              {user.email}
            </p>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8 px-4 py-6 md:px-8 lg:py-10">
        {isAdmin ? (
          permitted ? (
            children
          ) : (
            <NoAccess allowed={allowed} />
          )
        ) : (
          <p role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Tu usuario no tiene permisos de administrador.
          </p>
        )}
      </main>
    </div>
  )
}
