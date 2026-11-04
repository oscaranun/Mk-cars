"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Loader2 } from "lucide-react"
import { PasswordInput } from "@/components/admin/password-input"
import { authButtonClass, authFieldClass } from "@/components/admin/auth-shell"

type Status = "checking" | "ready" | "invalid" | "done"

export function ResetPasswordForm() {
  const router = useRouter()
  const supabase = useMemo(
    () =>
      createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { detectSessionInUrl: false },
      }),
    [],
  )
  const [status, setStatus] = useState<Status>("checking")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Turns the recovery tokens from the emailed link (URL hash) into a session.
  useEffect(() => {
    let cancelled = false
    async function init() {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hash.get("access_token")
      const refreshToken = hash.get("refresh_token")
      if (hash.get("error")) {
        if (!cancelled) setStatus("invalid")
        return
      }
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        window.history.replaceState(null, "", window.location.pathname)
        if (!cancelled) setStatus(sessionError ? "invalid" : "ready")
        return
      }
      const { data } = await supabase.auth.getUser()
      if (!cancelled) setStatus(data.user ? "ready" : "invalid")
    }
    init()
    return () => {
      cancelled = true
    }
  }, [supabase])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const confirm = String(form.get("confirm") ?? "")
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.")
    if (password !== confirm) return setError("Las contraseñas no coinciden.")
    setError(null)
    startTransition(async () => {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        if (updateError.code === "same_password") setError("La contraseña nueva tiene que ser distinta a la anterior.")
        else if (updateError.code === "weak_password") setError("La contraseña es demasiado débil.")
        else setError("No se pudo guardar la contraseña. Pedí un enlace nuevo.")
        return
      }
      setStatus("done")
      router.replace("/admin")
      router.refresh()
    })
  }

  if (status === "checking") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Verificando el enlace…
      </p>
    )
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-xl bg-sky px-4 py-3 text-sm text-white">
          El enlace venció o ya fue usado. Pedí uno nuevo.
        </p>
        <Link href="/admin/recuperar" className={authButtonClass}>
          Pedir enlace nuevo
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm text-muted-foreground">
          Contraseña nueva
        </label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required className={authFieldClass} />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="confirm" className="text-sm text-muted-foreground">
          Repetir contraseña
        </label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required className={authFieldClass} />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-sky px-4 py-3 text-sm text-white">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || status === "done"} className={authButtonClass}>
        {(pending || status === "done") && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
        Guardar contraseña
      </button>
    </form>
  )
}
