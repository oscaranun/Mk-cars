import type { ReactNode } from "react"
import { Logo } from "@/components/logo"

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="flex flex-col gap-6 rounded-[2rem] border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground text-pretty">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}

export const authFieldClass =
  "min-h-14 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground outline-none transition focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10"

export const authButtonClass =
  "mt-2 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-70"
