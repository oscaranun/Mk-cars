import type { Metadata } from "next"
import { Logo } from "@/components/logo"
import { LoginForm } from "@/components/admin/login-form"
import { SetupNotice } from "@/components/admin/setup-notice"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export const metadata: Metadata = {
  title: "Ingreso administrador — MK Cars",
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  const configured = isSupabaseConfigured()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        {configured ? (
          <div className="flex flex-col gap-6 rounded-[2rem] border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold tracking-tight">Panel de gestión</h1>
              <p className="text-sm text-muted-foreground">Acceso exclusivo para administradores.</p>
            </div>
            <LoginForm />
          </div>
        ) : (
          <SetupNotice />
        )}
      </div>
    </main>
  )
}
