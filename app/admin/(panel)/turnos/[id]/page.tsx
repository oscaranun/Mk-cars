import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"
import { TurnoFicha } from "@/components/admin/ficha/turno-ficha"
import { requireAdmin } from "@/lib/admin/auth"
import { getTurnoFicha } from "@/lib/admin/turno-ficha"

export const metadata: Metadata = { title: "Ficha del turno" }

export default async function TurnoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const ficha = await getTurnoFicha(supabase, id)
  if (!ficha) notFound()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/turnos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Turnos
        </Link>
        <Link
          href={`/admin/turnos/${ficha.id}/comprobante`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <FileText className="size-4" aria-hidden="true" />
          Comprobante
        </Link>
      </div>
      <TurnoFicha ficha={ficha} />
    </div>
  )
}
