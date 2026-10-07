import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 leading-none", className)}>
      <span className="text-xl font-semibold tracking-[-0.06em]">MK</span>
      <span className="h-3 w-px translate-y-px bg-foreground/40" aria-hidden="true" />
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.42em] text-silver">Cars</span>
    </span>
  )
}
