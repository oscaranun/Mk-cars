import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { TurnoFicha } from "@/components/admin/ficha/turno-ficha"
import { requireAdmin } from "@/lib/admin/auth"
import { getTurnoFicha } from "@/lib/admin/turno-ficha"

export const metadata = { title: "Ficha del turno (prueba) | MK Cars" }

export default async function PruebaFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const ficha = await getTurnoFicha(supabase, id)
  if (!ficha) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/pruebas/turnos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Turnos de prueba
      </Link>
      <TurnoFicha ficha={ficha} />
    </div>
  )
}
