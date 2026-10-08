import type { ReactNode } from "react"
import type { Metadata } from "next"
import { LogOut } from "lucide-react"
import { logout } from "@/app/admin/actions"
import { AdminNav } from "@/components/admin/admin-nav"
import { Logo } from "@/components/logo"
import { requireAdmin } from "@/lib/admin/auth"

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

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin } = await requireAdmin()

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <aside className="flex flex-col gap-4 border-b border-border bg-deep/60 px-4 pb-3 pt-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:gap-6 lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-center">
          <Logo className="w-[110px] md:w-[110px] lg:w-[170px]" />
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>
        {isAdmin && <AdminNav />}
        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          <p className="truncate text-xs text-muted-foreground" title={user.email ?? undefined}>
            {user.email}
          </p>
          <LogoutButton />
        </div>
      </aside>

      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8 px-4 py-6 md:px-8 lg:py-10">
        {isAdmin ? (
          children
        ) : (
          <p role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Tu usuario no tiene permisos de administrador.
          </p>
        )}
      </main>
    </div>
  )
}
