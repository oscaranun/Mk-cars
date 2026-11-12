import { cn } from "@/lib/utils"

export const EXTREME_DIRT_LABEL = "SUCIEDAD EXTREMA +20%"

export function ExtremeDirtNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-bold tracking-wide text-primary-foreground shadow-glow",
        className,
      )}
    >
      {EXTREME_DIRT_LABEL}
    </p>
  )
}
