import type { SupabaseClient } from "@supabase/supabase-js"
import { archiveClient, deleteClientPermanently, restoreClient } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { Card, Field, dangerButtonClass, fieldClass, labelClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatDateTime } from "@/lib/admin/format"

type DeletePreview = {
  blocked: boolean
  reasons: string[]
  vehicles: number
  inquiries: number
  appointments: number
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

type Props = {
  supabase: SupabaseClient
  client: { id: string; full_name: string; archived_at: string | null; archive_reason: string | null }
}

export async function ClientDangerZone({ supabase, client }: Props) {
  if (!client.archived_at) {
    return (
      <Card className="flex flex-col gap-4 border-red-400/20">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Zona de riesgo</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Archivar oculta al cliente de la lista, del inicio y de la exportación. No se borra nada y se puede restaurar.
          </p>
        </div>
        <ActionForm
          action={archiveClient}
          submitLabel="Archivar cliente"
          submitClassName={secondaryButtonClass}
          confirmText={`¿Archivar a ${client.full_name}?`}
        >
          <input type="hidden" name="id" value={client.id} />
          <Field label="Motivo (opcional)" htmlFor="archive_reason">
            <input id="archive_reason" name="reason" maxLength={500} placeholder="Ej.: reserva de prueba, duplicado" className={fieldClass} />
          </Field>
        </ActionForm>
      </Card>
    )
  }

  const { data, error } = await supabase.rpc("delete_client_permanently", { p_id: client.id, p_dry_run: true })
  if (error) console.error("[admin] client delete preview:", error.code, error.message)
  const preview = data as DeletePreview | null

  return (
    <Card className="flex flex-col gap-4 border-red-400/20">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Zona de riesgo</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Archivado el {formatDateTime(client.archived_at)}
          {client.archive_reason ? ` · Motivo: ${client.archive_reason}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <ActionForm action={restoreClient} submitLabel="Restaurar cliente" submitClassName={secondaryButtonClass} inline>
          <input type="hidden" name="id" value={client.id} />
        </ActionForm>

        <ConfirmAction
          action={deleteClientPermanently}
          fields={{ id: client.id }}
          triggerLabel="Eliminar definitivamente"
          triggerClassName={dangerButtonClass}
          disabled={!preview || preview.blocked}
          title="Eliminar cliente definitivamente"
          description="Esta acción no se puede deshacer. Queda una copia de los datos en el registro de auditoría."
          confirmLabel="Sí, eliminar definitivamente"
        >
          {preview && (
            <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm">
              <p className="font-medium">Se eliminará:</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                <li>El cliente {client.full_name}</li>
                <li>{plural(preview.vehicles, "vehículo", "vehículos")}</li>
                <li>{plural(preview.inquiries, "consulta", "consultas")}</li>
                <li>{plural(preview.appointments, "turno", "turnos")}</li>
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete_confirmation" className={labelClass}>
              Para confirmar, escribí el nombre o el WhatsApp del cliente
            </label>
            <input
              id="delete_confirmation"
              name="confirmation"
              required
              autoComplete="off"
              placeholder={client.full_name}
              className={fieldClass}
            />
          </div>
        </ConfirmAction>
      </div>

      {!preview ? (
        <p className="text-sm text-muted-foreground">No se pudo verificar si se puede eliminar. Recargá la página.</p>
      ) : preview.blocked ? (
        <p className="text-sm text-amber-200 text-pretty">
          No se puede eliminar definitivamente: {preview.reasons.join(" ")} Solo puede quedar archivado.
        </p>
      ) : null}
    </Card>
  )
}
