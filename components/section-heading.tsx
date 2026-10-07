export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  inverse = false,
}: {
  eyebrow: string
  title: string
  description?: string
  id: string
  inverse?: boolean
}) {
  return (
    <div className="max-w-2xl">
      <p className={`font-mono text-xs uppercase tracking-[0.25em] ${inverse ? "text-inverse-muted" : "text-muted-foreground"}`}>
        {eyebrow}
      </p>
      <h2 id={id} className="mt-4 text-balance text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
        {title}
      </h2>
      {description ? (
        <p className={`mt-5 text-pretty text-base leading-relaxed md:text-lg ${inverse ? "text-inverse-muted" : "text-muted-foreground"}`}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
