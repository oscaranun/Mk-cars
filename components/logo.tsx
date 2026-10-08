import Image from "next/image"
import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string; compact?: boolean; inverted?: boolean }) {
  return (
    <Image
      src="/images/mk-logo.png"
      alt="MK Car Wash Premium a domicilio"
      width={258}
      height={140}
      priority
      draggable={false}
      className={cn("h-auto w-[140px] shrink-0 select-none md:w-[160px] lg:w-[220px]", className)}
    />
  )
}
