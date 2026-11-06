"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { moveAppointment } from "@/app/admin/(panel)/pro-actions"
import { cn } from "@/lib/utils"

const MIME = "application/x-mk-appointment"

export function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME, id)
        e.dataTransfer.effectAllowed = "move"
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </li>
  )
}

export function DropColumn({
  status,
  title,
  count,
  hint,
  children,
}: {
  status: string | null
  title: string
  count: number
  hint?: string
  children: ReactNode
}) {
  const router = useRouter()
  const [over, setOver] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <section
      aria-label={`${title}: ${count}`}
      onDragOver={(e) => {
        if (!status || !e.dataTransfer.types.includes(MIME)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const id = e.dataTransfer.getData(MIME)
        if (!status || !id) return
        e.preventDefault()
        const data = new FormData()
        data.set("appointment_id", id)
        data.set("status", status)
        startTransition(async () => {
          const res = await moveAppointment({ ok: false, message: null }, data)
          setMessage({ ok: res.ok, text: res.message ?? "" })
          if (res.ok) router.refresh()
        })
      }}
      className={cn(
        "flex min-w-72 flex-1 flex-col gap-3 rounded-3xl border bg-surface/60 p-3 transition",
        over ? "border-primary bg-primary/10" : "border-border",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="flex items-center gap-2">
          {pending && <Loader2 className="size-4 animate-spin text-electric" aria-label="Guardando" />}
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-electric">{count}</span>
        </span>
      </header>
      {hint && <p className="px-1 text-xs text-muted-foreground">{hint}</p>}
      <p aria-live="polite" className={cn("px-1 text-xs", message?.ok ? "text-emerald-300" : "text-red-200", !message && "sr-only")}>
        {message?.text}
      </p>
      <ul className="flex flex-col gap-3">{children}</ul>
    </section>
  )
}
