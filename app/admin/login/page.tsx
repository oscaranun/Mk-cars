import type { Metadata } from "next"
import { Logo } from "@/components/logo"
import { LoginForm } from "@/components/admin/login-form"
import { SetupNotice } from "@/components/admin/setup-notice"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { FirstAdminForm } from "@/components/admin/first-admin-form"
import { hasAnyAdmin } from "@/lib/supabase/service"

export const metadata: Metadata = {
  title: "Ingreso administrador — MK Cars",
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage() {
  const configured = isSupabaseConfigured()
  const needsFirstAdmin = configured && !(await hasAnyAdmin())

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        {configured ? (
          <div className="flex flex-col gap-6 rounded-[2rem] border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold tracking-tight">
                {needsFirstAdmin ? "Creá tu cuenta de administrador" : "Panel de gestión"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {needsFirstAdmin
                  ? "Este paso se hace una sola vez. Después solo vas a ver el ingreso."
                  : "Acceso exclusivo para administradores."}
              </p>
            </div>
            {needsFirstAdmin ? <FirstAdminForm /> : <LoginForm />}
          </div>
        ) : (
          <SetupNotice />
        )}
      </div>
    </main>
  )
}
