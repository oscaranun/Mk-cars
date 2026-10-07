import { Reveal } from "@/components/reveal"

export function SectionHeading({
  index,
  eyebrow,
  title,
  description,
}: {
  index: string
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <Reveal className="flex flex-col gap-5">
      <p className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.3em] text-muted-foreground">
        <span className="text-foreground">{index}</span>
        <span className="h-px w-8 bg-border" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="text-balance text-[2.25rem] font-medium leading-[1.02] tracking-[-0.04em] sm:text-5xl md:text-6xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">{description}</p>
      )}
    </Reveal>
  )
}
