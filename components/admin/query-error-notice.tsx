export function QueryErrorNotice({ subject = "los datos" }: { subject?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-400/30 bg-card p-5 text-sm text-red-200">
      No se pudieron consultar {subject}. No se muestran importes ni listas vacías como si fueran datos confirmados.
      Recargá la página. Si persiste, revisá la conexión y las actualizaciones de esta base.
    </div>
  )
}
