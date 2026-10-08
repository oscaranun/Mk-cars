import { DatabaseZap } from "lucide-react"

export function SetupNotice() {
  return (
    <div role="status" className="flex flex-col gap-4 rounded-[2rem] border border-border bg-card p-6 shadow-soft sm:p-8">
      <DatabaseZap className="size-8 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Base de datos sin conectar</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          El panel y la captura de reservas necesitan Supabase. Hasta conectarlo, no se guarda ningún dato.
        </p>
      </div>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>Conectá la integración Supabase desde Settings en v0.</li>
        <li>
          Ejecutá <code className="font-mono text-foreground">scripts/001_mk_cars_schema.sql</code>.
        </li>
        <li>Creá tu usuario administrador y agregalo a la tabla admins.</li>
      </ol>
    </div>
  )
}
