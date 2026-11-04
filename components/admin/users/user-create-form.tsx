"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Loader2, UserPlus } from "lucide-react"
import { createPanelUser } from "@/app/admin/(panel)/usuarios/actions"
import { AccessFields } from "@/components/admin/users/access-fields"
import { PasswordInput } from "@/components/admin/password-input"
import { Card, Field, fieldClass, primaryButtonClass } from "@/components/admin/ui"
import { FormMessage } from "@/components/admin/users/form-message"

export function UserCreateForm() {
  const [state, action, pending] = useActionState(createPanelUser, { ok: false, message: null })
  const formRef = useRef<HTMLFormElement>(null)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset()
      setFormKey((k) => k + 1)
    }
  }, [state])

  return (
    <Card>
      <form ref={formRef} action={action} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Nombre" htmlFor="new-full-name">
            <input id="new-full-name" name="full_name" required autoComplete="off" className={`${fieldClass} text-base`} />
          </Field>
          <Field label="Correo" htmlFor="new-email">
            <input id="new-email" name="email" type="email" required autoComplete="off" className={`${fieldClass} text-base`} />
          </Field>
          <Field label="Contraseña inicial (mín. 8)" htmlFor="new-password">
            <PasswordInput
              id="new-password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={`${fieldClass} text-base`}
            />
          </Field>
        </div>
        <AccessFields key={formKey} />
        <FormMessage state={state} />
        <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full sm:w-fit`}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
          Crear usuario
        </button>
      </form>
    </Card>
  )
}
