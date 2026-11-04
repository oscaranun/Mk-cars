"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { login, type LoginState } from "@/app/admin/actions"
import { PasswordInput } from "@/components/admin/password-input"

const fieldClass =
  "min-h-14 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground outline-none transition focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10"

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null })

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm text-muted-foreground">
          Correo electrónico
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className="text-sm text-muted-foreground">
            Contraseña
          </label>
          <Link
            href="/admin/recuperar"
            className="inline-flex min-h-11 items-center text-sm font-medium text-electric underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" required className={fieldClass} />
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl bg-sky px-4 py-3 text-sm text-white">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-70"
      >
        {pending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
        Ingresar
      </button>
    </form>
  )
}
