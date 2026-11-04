import type { Metadata } from "next"
import { AuthShell } from "@/components/admin/auth-shell"
import { ResetPasswordForm } from "@/components/admin/reset-password-form"

export const metadata: Metadata = {
  title: "Nueva contraseña — MK Cars",
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Elegí una contraseña nueva" description="Mínimo 8 caracteres. Podés mostrarla para revisarla antes de guardar.">
      <ResetPasswordForm />
    </AuthShell>
  )
}
