import { cn } from "@/lib/utils"

export const EXTREME_DIRT_LABEL = "SUCIEDAD EXTREMA +20%"

export function ExtremeDirtNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "rounded-xl bg-red-600 px-4 py-2.5 text-center text-sm font-bold tracking-wide text-white shadow-sm shadow-red-950/30",
        className,
      )}
    >
      {EXTREME_DIRT_LABEL}
    </p>
  )
}
