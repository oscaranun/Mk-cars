import Image from "next/image"
import { cn } from "@/lib/utils"

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 leading-none", className)}>
      <Image
        src="/images/mk-logo.png"
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-full ring-1 ring-white/20"
        priority
      />
      <span className="flex flex-col gap-1">
        <span
          className={cn(
            "text-[1.05rem] font-extrabold italic tracking-[-0.03em]",
            inverted ? "text-white" : "text-foreground",
          )}
        >
          MK <span className={inverted ? "text-electric" : "text-primary"}>Car Wash</span>
        </span>
        <span
          className={cn(
            "text-[0.6rem] font-semibold uppercase tracking-[0.22em]",
            inverted ? "text-white/60" : "text-muted-foreground",
          )}
        >
          A domicilio
        </span>
      </span>
    </span>
  )
}
