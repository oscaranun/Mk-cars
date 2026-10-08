"use client"

import { useActionState, useEffect, useRef, useTransition, type ReactNode } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import type { ActionState } from "@/app/admin/(panel)/crm-actions"
import { primaryButtonClass } from "@/components/admin/ui"
import { cn } from "@/lib/utils"

type Props = {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>
  children?: ReactNode
  submitLabel: string
  submitClassName?: string
  className?: string
  confirmText?: string
  resetOnSuccess?: boolean
  inline?: boolean
}

/**
 * Submits through a transition instead of the form `action` prop so React does not
 * clear the fields when the server rejects the data.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  submitClassName,
  className,
  confirmText,
  resetOnSuccess,
  inline,
}: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: null })
  const [, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset()
  }, [state, resetOnSuccess])

  return (
    <form
      ref={formRef}
      className={cn(inline ? "flex flex-wrap items-end gap-2" : "flex flex-col gap-4", className)}
      onSubmit={(event) => {
        event.preventDefault()
        if (confirmText && !window.confirm(confirmText)) return
        const data = new FormData(event.currentTarget)
        startTransition(() => formAction(data))
      }}
    >
      {children}
      <div className={cn("flex flex-wrap items-center gap-3", inline && "contents")}>
        <button type="submit" disabled={pending} className={submitClassName ?? primaryButtonClass}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitLabel}
        </button>
        <p aria-live="polite" className={cn("text-sm", !state.message && "sr-only", inline && "basis-full")}>
          {state.message && (
            <span className={cn("inline-flex items-center gap-1.5", state.ok ? "text-emerald-300" : "text-red-200")}>
              {state.ok && <CheckCircle2 className="size-4" aria-hidden="true" />}
              {state.message}
            </span>
          )}
        </p>
      </div>
    </form>
  )
}
