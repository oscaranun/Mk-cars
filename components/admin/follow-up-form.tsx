import { recordFollowUp } from "@/app/admin/(panel)/recontactar/actions"
import { fieldClass as inputClass, primaryButtonClass } from "@/components/admin/ui"

const labelClass = "text-sm font-medium text-muted-foreground"
import { cn } from "@/lib/utils"

export function FollowUpForm({
  clientId,
  defaultDate,
  compact = false,
}: {
  clientId: string
  defaultDate?: string | null
  compact?: boolean
}) {
  const id = `fu-${clientId}`
  return (
    <details className={cn("group", compact ? "text-left" : "")}>
      <summary className="cursor-pointer list-none text-sm font-medium text-electric hover:underline [&::-webkit-details-marker]:hidden">
        {compact ? "Programar seguimiento" : "Registrar contacto"}
      </summary>
      <form action={recordFollowUp} className="mt-3 grid gap-3 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-2">
        <input type="hidden" name="client_id" value={clientId} />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`${id}-note`} className={labelClass}>
            Nota
          </label>
          <textarea id={`${id}-note`} name="note" rows={2} maxLength={1000} className={inputClass} placeholder="Qué hablaron, qué pidió" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-next`} className={labelClass}>
            Próximo seguimiento
          </label>
          <input id={`${id}-next`} name="next_follow_up" type="date" defaultValue={defaultDate ?? ""} className={inputClass} />
        </div>
        <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
          <input type="checkbox" name="contacted" defaultChecked={!compact} className="size-4 accent-primary" />
          Ya lo contacté hoy
        </label>
        <p className="text-xs text-muted-foreground sm:col-span-2">Dejá la fecha vacía para sacarlo de seguimiento.</p>
        <button type="submit" className={cn(primaryButtonClass, "sm:col-span-2 sm:justify-self-start")}>
          Guardar
        </button>
      </form>
    </details>
  )
}
