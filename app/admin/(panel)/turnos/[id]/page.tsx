import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"
import { TurnoFicha } from "@/components/admin/ficha/turno-ficha"
import { requireAdmin } from "@/lib/admin/auth"
import { getTurnoFicha } from "@/lib/admin/turno-ficha"
import { DuplicateNotice } from "@/components/admin/duplicate-notice"
import { findDuplicatesOf } from "@/lib/admin/duplicates"

export const metadata: Metadata = { title: "Ficha del turno" }

export default async function TurnoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const ficha = await getTurnoFicha(supabase, id)
  if (!ficha) notFound()
  const duplicates = await findDuplicatesOf(supabase, {
    id: ficha.id,
    clientId: ficha.client.id,
    start: ficha.start,
    status: ficha.status,
  })

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
      {duplicates.length > 0 && <DuplicateNotice appointmentId={ficha.id} matches={duplicates} />}
      <TurnoFicha ficha={ficha} />
    </div>
  )
}
