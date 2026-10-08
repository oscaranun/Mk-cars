import type { ReactNode } from "react"
import Link from "next/link"
import { Download } from "lucide-react"
import type { Tone } from "@/lib/admin/labels"
import { cn } from "@/lib/utils"

export const fieldClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none transition [color-scheme:dark] placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/15"

export const labelClass = "text-xs font-medium text-muted-foreground"

export const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium text-foreground transition hover:border-electric/60 active:scale-[0.98] disabled:opacity-60"

export const dangerButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-5 text-sm font-medium text-red-200 transition hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-60"

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border border-border bg-card p-5 shadow-soft", className)}>{children}</div>
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {aside}
    </div>
  )
}

const TONES: Record<Tone, string> = {
  neutral: "bg-surface text-muted-foreground border-border",
  info: "bg-primary/15 text-electric border-primary/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  warning: "bg-amber-400/15 text-amber-200 border-amber-300/30",
  danger: "bg-red-500/15 text-red-200 border-red-400/30",
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-4 shadow-soft">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ExportLink({ entity, query }: { entity: string; query?: Record<string, string | undefined> }) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) if (v) params.set(k, v)
  const qs = params.toString()
  return (
    <a href={`/admin/exportar/${entity}${qs ? `?${qs}` : ""}`} className={secondaryButtonClass} download>
      <Download className="size-4" aria-hidden="true" />
      Exportar CSV
    </a>
  )
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-soft">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  )
}

export const thClass = "border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground"
export const tdClass = "border-b border-border/60 px-4 py-3 align-top"

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-foreground underline-offset-4 hover:text-electric hover:underline">
      {children}
    </Link>
  )
}

/** Plain GET form so filters work without client JavaScript and stay in the URL. */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <form method="get" className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 md:flex-row md:flex-wrap md:items-end">
      {children}
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass}>
          Filtrar
        </button>
        <Link href={resetHref} className={secondaryButtonClass}>
          Limpiar
        </Link>
      </div>
    </form>
  )
}

export function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  )
}
