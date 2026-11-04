import type { ActionState } from "@/app/admin/(panel)/crm-actions"
import { cn } from "@/lib/utils"

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        state.ok ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200",
      )}
    >
      {state.message}
    </p>
  )
}
