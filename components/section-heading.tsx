import { Reveal } from "@/components/reveal"
import { cn } from "@/lib/utils"

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string
  title: string
  description?: string
  align?: "left" | "center"
}) {
  return (
    <Reveal className={cn("flex flex-col gap-3", align === "center" && "items-center text-center")}>
      <p className="inline-flex w-fit items-center gap-2 rounded-full bg-sky px-3 py-1 text-xs font-medium text-primary">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="text-balance text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-md text-pretty text-[0.95rem] leading-relaxed text-muted-foreground">{description}</p>
      )}
    </Reveal>
  )
}
