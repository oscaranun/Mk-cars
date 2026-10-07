import { cn } from "@/lib/utils"

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 leading-none", className)}>
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-xl text-[0.8rem] font-bold tracking-[-0.04em]",
          inverted ? "bg-white text-deep" : "bg-primary text-primary-foreground",
        )}
      >
        MK
      </span>
      <span className={cn("text-lg font-semibold tracking-[-0.03em]", inverted ? "text-white" : "text-deep")}>
        Cars
      </span>
    </span>
  )
}
