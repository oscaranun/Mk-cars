import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string; compact?: boolean; inverted?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-[210px] shrink-0 items-center justify-center leading-none md:size-[320px]",
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
          className="h-auto w-[132px] md:w-[200px]"
          draggable={false}
        />
        <span
          aria-hidden="true"
          className="mt-1 whitespace-nowrap text-[15px] font-black uppercase italic leading-none tracking-tight md:text-[23px]"
        >
          <span className="text-[#0B0F14]">Car Wash </span>
          <span className="text-[#1477E6]">Premium</span>
        </span>
        <span aria-hidden="true" className="mt-1.5 flex items-center gap-2 md:mt-2 md:gap-3">
          <span className="h-px w-4 bg-[#1477E6] md:w-7" />
          <span className="text-[9px] font-medium uppercase leading-none tracking-[0.35em] text-[#2A3240] md:text-[13px]">
            A Domicilio
          </span>
          <span className="h-px w-4 bg-[#1477E6] md:w-7" />
        </span>
      </span>
    </span>
  )
}
