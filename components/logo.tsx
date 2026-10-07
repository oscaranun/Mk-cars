import Image from "next/image"
import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3 leading-none", className)}>
      <Image
        src="/images/mk-logo-clean.png"
        alt="MK"
        width={138}
        height={56}
        className="h-12 w-auto md:h-[3.75rem]"
        priority
        unoptimized
      />
      <span className="flex flex-col gap-1">
        <span className="text-[1.05rem] font-extrabold italic tracking-[-0.03em] text-electric">Car Wash</span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-white/60">A domicilio</span>
      </span>
    </span>
  )
}
