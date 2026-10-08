"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { createFirstAdmin, type LoginState } from "@/app/admin/actions"

const fieldClass =
  "min-h-14 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground outline-none transition focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10"

export function FirstAdminForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(createFirstAdmin, { error: null })

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm text-muted-foreground">
          Correo electrónico
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm text-muted-foreground">
          Contraseña (mínimo 8 caracteres)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="confirm" className="text-sm text-muted-foreground">
          Repetí la contraseña
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={fieldClass}
        />
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
        Crear administrador
      </button>
    </form>
  )
}
