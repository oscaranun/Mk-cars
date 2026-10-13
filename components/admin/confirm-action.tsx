"use client"

import { useActionState, useEffect, useId, useRef, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import type { ActionState } from "@/app/admin/(panel)/crm-actions"
import { dangerButtonClass, secondaryButtonClass } from "@/components/admin/ui"
import { cn } from "@/lib/utils"

type Props = {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>
  fields: Record<string, string>
  triggerLabel: string
  triggerClassName?: string
  title: string
  description: string
  children?: ReactNode
  confirmLabel?: string
  disabled?: boolean
  redirectTo?: string
}

export const dangerTextButtonClass =
  "inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full px-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"

export function ConfirmAction({
  action,
  fields,
  triggerLabel,
  triggerClassName,
  title,
  description,
  children,
  confirmLabel = "Sí, eliminar",
  disabled,
  redirectTo,
}: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: null })
  const [, startTransition] = useTransition()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!state.ok) return
    dialogRef.current?.close()
    if (redirectTo) router.replace(redirectTo)
  }, [state, redirectTo, router])

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
        className={triggerClassName ?? dangerTextButtonClass}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-3xl border border-border bg-card p-0 text-foreground shadow-soft backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        onCancel={(event) => pending && event.preventDefault()}
      >
        <form
          className="flex flex-col gap-5 p-6"
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            startTransition(() => formAction(data))
          }}
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="flex flex-col gap-2">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <p id={descriptionId} className="text-sm text-muted-foreground text-pretty">
              {description}
            </p>
          </div>
          {children}
          {state.message && !state.ok && (
            <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {state.message}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              className={secondaryButtonClass}
              autoFocus
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={cn(dangerButtonClass)}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
