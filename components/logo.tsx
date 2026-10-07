import Image from "next/image"
import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("relative inline-flex w-fit shrink-0 self-start items-center leading-none", className)}>
      {/* Soft white glow behind the dark lettering that fades out into the navy background */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-[22%] -inset-y-[42%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.96)_52%,rgba(255,255,255,0.7)_64%,rgba(255,255,255,0.3)_80%,rgba(255,255,255,0)_100%)] blur-md"
      />
      <Image
        src="/images/mk-logo-hd2.png"
        alt="MK Car Wash Premium a domicilio"
        width={1074}
        height={467}
        sizes="(min-width: 768px) 129px, 113px"
        className="relative h-12 w-auto md:h-14"
        priority
        quality={95}
      />
    </span>
  )
}
