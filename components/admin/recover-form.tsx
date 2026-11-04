"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { requestPasswordReset, type ResetRequestState } from "@/app/admin/actions"
import { authButtonClass, authFieldClass } from "@/components/admin/auth-shell"

export function RecoverForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(requestPasswordReset, {
    ok: false,
    message: null,
  })

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm text-muted-foreground">
          Correo electrónico
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={authFieldClass} />
      </div>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
              : "rounded-xl bg-sky px-4 py-3 text-sm text-white"
          }
        >
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={authButtonClass}>
        {pending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
        Enviar enlace
      </button>
      <Link
        href="/admin/login"
        className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-electric underline-offset-4 hover:underline"
      >
        Volver al ingreso
      </Link>
    </form>
  )
}
