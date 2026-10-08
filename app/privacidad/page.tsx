import type { Metadata } from "next"
import Link from "next/link"
import { EMAIL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Política de privacidad — MK Cars",
  description: "Cómo MK Cars recopila, usa y protege tus datos personales.",
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-12 leading-relaxed md:py-20">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
        ← Volver al inicio
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Política de privacidad</h1>
      <p className="text-muted-foreground">
        MK Cars recopila los datos que completás en el formulario de reserva (nombre, WhatsApp, correo, dirección,
        datos del vehículo y observaciones) con el único fin de gestionar tu solicitud, coordinar el servicio y
        mantener el historial de atención.
      </p>
      <h2 className="text-xl font-semibold">Promociones</h2>
      <p className="text-muted-foreground">
        Solo te enviaremos promociones o recordatorios si lo aceptaste expresamente. Podés retirar ese consentimiento
        en cualquier momento.
      </p>
      <h2 className="text-xl font-semibold">Seguridad y conservación</h2>
      <p className="text-muted-foreground">
        Tus datos se almacenan en una base de datos protegida, accesible únicamente por administradores autorizados.
        No los vendemos ni compartimos con terceros.
      </p>
      <h2 className="text-xl font-semibold">Tus derechos</h2>
      <p className="text-muted-foreground">
        Conforme a la Ley 25.326 de Protección de Datos Personales, podés solicitar el acceso, rectificación o
        eliminación de tus datos escribiendo a{" "}
        <a href={`mailto:${EMAIL}`} className="break-all text-foreground underline underline-offset-2">
          {EMAIL}
        </a>
        .
      </p>
    </main>
  )
}
