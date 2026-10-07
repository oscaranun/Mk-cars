import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string; compact?: boolean; inverted?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-[137px] shrink-0 items-center justify-center leading-none md:size-[208px]",
        className,
      )}
    >
      {/* Perfect white circle that fades softly into the navy background at its edge */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,1)_84%,rgba(255,255,255,0.55)_93%,rgba(255,255,255,0)_100%)]"
      />
      <span className="relative flex flex-col items-center">
        <span className="sr-only">MK Car Wash Premium a domicilio</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- vector wordmark, no optimization needed */}
        <img
          src="/images/mk-wordmark.svg"
          alt=""
          aria-hidden="true"
          width={1160}
          height={544}
          className="h-auto w-[86px] md:w-[130px]"
          draggable={false}
        />
        <span
          aria-hidden="true"
          className="mt-0.5 whitespace-nowrap text-[10px] font-black uppercase italic leading-none tracking-tight md:mt-1 md:text-[15px]"
        >
          <span className="text-[#0B0F14]">Car Wash </span>
          <span className="text-[#1477E6]">Premium</span>
        </span>
        <span aria-hidden="true" className="mt-1 flex items-center gap-1.5 md:mt-1.5 md:gap-2">
          <span className="h-px w-2.5 bg-[#1477E6] md:w-[18px]" />
          <span className="text-[6px] font-medium uppercase leading-none tracking-[0.35em] text-[#2A3240] md:text-[8.5px]">
            A Domicilio
          </span>
          <span className="h-px w-2.5 bg-[#1477E6] md:w-[18px]" />
        </span>
      </span>
    </span>
  )
}
