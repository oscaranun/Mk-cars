import type { Metadata } from "next"
import { AuthShell } from "@/components/admin/auth-shell"
import { RecoverForm } from "@/components/admin/recover-form"

export const metadata: Metadata = {
  title: "Recuperar contraseña — MK Cars",
  robots: { index: false, follow: false },
}

export default function RecoverPage() {
  return (
    <AuthShell
      title="Recuperar contraseña"
      description="Ingresá el correo de tu usuario y te enviamos un enlace para elegir una contraseña nueva."
    >
      <RecoverForm />
    </AuthShell>
  )
}
