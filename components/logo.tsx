import Image from "next/image"
import { cn } from "@/lib/utils"

export function Logo({ className, compact = false }: { className?: string; compact?: boolean; inverted?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex aspect-square shrink-0 items-center justify-center leading-none transition-[width,height] duration-300",
        compact ? "size-[104px] md:size-[120px]" : "size-[210px] md:size-[320px]",
        className,
      )}
    >
      {/* Perfect white circle that fades softly into the navy background at its edge */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,1)_84%,rgba(255,255,255,0.55)_93%,rgba(255,255,255,0)_100%)]"
      />
      <Image
        src="/images/mk-logo-hd2.png"
        alt="MK Car Wash Premium a domicilio"
        width={1074}
        height={467}
        sizes="(min-width: 768px) 258px, 184px"
        className={cn(
          "relative w-auto transition-[height] duration-300",
          compact ? "h-10 md:h-11" : "h-20 md:h-28",
        )}
        priority
        quality={100}
      />
    </span>
  )
}
