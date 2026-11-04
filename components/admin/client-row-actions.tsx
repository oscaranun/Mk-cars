import { archiveClient, deleteClientPermanently, restoreClient } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { fieldClass, labelClass } from "@/components/admin/ui"

const textButtonClass =
  "inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition hover:bg-sky/60 hover:text-foreground disabled:opacity-60"

type Props = { client: { id: string; full_name: string }; archived: boolean }

export function ClientRowActions({ client, archived }: Props) {
  if (!archived) {
    return (
      <ConfirmAction
        action={archiveClient}
        fields={{ id: client.id }}
        triggerLabel="Archivar"
        triggerClassName={textButtonClass}
        title={`Archivar a ${client.full_name}`}
        description="Se oculta de la lista, del inicio y de la exportación. No se borra nada y lo podés restaurar desde Archivados."
        confirmLabel="Sí, archivar"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`archive_reason_${client.id}`} className={labelClass}>
            Motivo (opcional)
          </label>
          <input
            id={`archive_reason_${client.id}`}
            name="reason"
            maxLength={500}
            placeholder="Ej.: duplicado, no interesado"
            className={fieldClass}
          />
        </div>
      </ConfirmAction>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <ActionForm action={restoreClient} submitLabel="Restaurar" submitClassName={textButtonClass} inline>
        <input type="hidden" name="id" value={client.id} />
      </ActionForm>
      <ConfirmAction
        action={deleteClientPermanently}
        fields={{ id: client.id }}
        triggerLabel="Eliminar"
        title="Eliminar cliente definitivamente"
        description="Se borran el cliente, sus vehículos, consultas, turnos, servicios y cobros. No se puede deshacer; queda una copia en el registro de auditoría."
        confirmLabel="Sí, eliminar definitivamente"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`delete_confirmation_${client.id}`} className={labelClass}>
            Para confirmar, escribí el nombre o el WhatsApp del cliente
          </label>
          <input
            id={`delete_confirmation_${client.id}`}
            name="confirmation"
            required
            autoComplete="off"
            placeholder={client.full_name}
            className={fieldClass}
          />
        </div>
      </ConfirmAction>
    </div>
  )
}
