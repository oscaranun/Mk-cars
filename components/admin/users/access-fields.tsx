"use client"

import { useId, useState } from "react"
import { SECTIONS, type AdminRole } from "@/lib/admin/permissions"
import { labelClass } from "@/components/admin/ui"
import { cn } from "@/lib/utils"

export function AccessFields({
  defaultRole = "staff",
  defaultPermissions = [],
  lockRole = false,
}: {
  defaultRole?: AdminRole
  defaultPermissions?: string[]
  lockRole?: boolean
}) {
  const [role, setRole] = useState<AdminRole>(defaultRole)
  const groupId = useId()

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2" disabled={lockRole}>
        <legend className={cn(labelClass, "mb-2")}>Tipo de acceso</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              { value: "staff", title: "Personal", hint: "Solo las secciones elegidas" },
              { value: "owner", title: "Propietario", hint: "Todo, incluido Usuarios" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                role === opt.value ? "border-primary bg-primary/10" : "border-border bg-surface",
              )}
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
                className="size-5 accent-[var(--color-primary)]"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{opt.title}</span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {lockRole && <input type="hidden" name="role" value={role} />}
      </fieldset>

      {role === "staff" ? (
        <fieldset className="flex flex-col gap-2" aria-describedby={`${groupId}-hint`}>
          <legend className={cn(labelClass, "mb-1")}>Secciones que puede ver</legend>
          <p id={`${groupId}-hint`} className="text-xs text-muted-foreground">
            Los cambios aplican la próxima vez que abra una página.
          </p>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3">
            {SECTIONS.map((s) => (
              <label
                key={s.key}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 text-sm transition has-[:checked]:border-primary has-[:checked]:bg-primary/10"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={s.key}
                  defaultChecked={defaultPermissions.includes(s.key)}
                  className="size-5 accent-[var(--color-primary)]"
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          El propietario ve todas las secciones y puede administrar usuarios.
        </p>
      )}
    </div>
  )
}
