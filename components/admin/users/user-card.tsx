"use client"

import { useActionState, useState } from "react"
import { ChevronDown, Loader2, Mail, Save } from "lucide-react"
import { deletePanelUser, sendUserPasswordReset, updatePanelUser } from "@/app/admin/(panel)/usuarios/actions"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { AccessFields } from "@/components/admin/users/access-fields"
import { FormMessage } from "@/components/admin/users/form-message"
import { Badge, Card, Field, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui"
import { SECTIONS, type AdminRole } from "@/lib/admin/permissions"
import { cn } from "@/lib/utils"

export type PanelUser = {
  id: string
  fullName: string | null
  email: string
  lastSignIn: string | null
  role: AdminRole
  permissions: string[]
  isSelf: boolean
}

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" })

export function UserCard({ user }: { user: PanelUser }) {
  const [open, setOpen] = useState(false)
  const [saveState, saveAction, saving] = useActionState(updatePanelUser, { ok: false, message: null })
  const [mailState, mailAction, mailing] = useActionState(sendUserPasswordReset, { ok: false, message: null })
  const labels = SECTIONS.filter((s) => user.permissions.includes(s.key)).map((s) => s.label)

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{user.fullName || user.email}</h3>
          <Badge tone={user.role === "owner" ? "success" : "neutral"}>{user.role === "owner" ? "Propietario" : "Personal"}</Badge>
          {user.isSelf && <Badge>Vos</Badge>}
        </div>
        <p className="break-all text-sm text-muted-foreground">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          {user.lastSignIn ? `Último ingreso: ${dateFmt.format(new Date(user.lastSignIn))}` : "Todavía no ingresó"}
        </p>
        <p className="text-sm text-muted-foreground text-pretty">
          {user.role === "owner" ? "Acceso total" : labels.length ? labels.join(" · ") : "Sin secciones"}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <form action={mailAction}>
          <input type="hidden" name="user_id" value={user.id} />
          <button type="submit" disabled={mailing} className={cn(secondaryButtonClass, "w-full sm:w-fit")}>
            {mailing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
            Enviar mail para cambiar contraseña
          </button>
        </form>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`edit-${user.id}`}
          className={cn(secondaryButtonClass, "w-full sm:w-fit")}
        >
          <ChevronDown className={cn("size-4 transition", open && "rotate-180")} aria-hidden="true" />
          Editar permisos
        </button>
      </div>
      <FormMessage state={mailState} />

      {open && (
        <form id={`edit-${user.id}`} action={saveAction} className="flex flex-col gap-4 border-t border-border pt-4">
          <input type="hidden" name="user_id" value={user.id} />
          <Field label="Nombre" htmlFor={`name-${user.id}`}>
            <input
              id={`name-${user.id}`}
              name="full_name"
              defaultValue={user.fullName ?? ""}
              autoComplete="off"
              className={`${fieldClass} text-base`}
            />
          </Field>
          <AccessFields defaultRole={user.role} defaultPermissions={user.permissions} lockRole={user.isSelf} />
          <FormMessage state={saveState} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {!user.isSelf ? (
              <ConfirmAction
                action={deletePanelUser}
                fields={{ user_id: user.id }}
                triggerLabel="Eliminar usuario"
                title="¿Eliminar este usuario?"
                description={`${user.email} ya no va a poder ingresar al panel. Esta acción no se puede deshacer.`}
              />
            ) : (
              <span />
            )}
            <button type="submit" disabled={saving} className={cn(primaryButtonClass, "w-full sm:w-fit")}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
              Guardar
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}
