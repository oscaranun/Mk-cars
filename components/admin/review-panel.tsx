"use client"

import { useState } from "react"
import { AlertTriangle, Check, Copy, Link2, MessageCircle, RotateCcw, Star } from "lucide-react"
import { setClientReview } from "@/app/admin/(panel)/review-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Badge, Card, Field, SectionTitle, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui"
import { formatDateTime } from "@/lib/admin/format"
import { GOOGLE_REVIEW_URL, REVIEW_STATUS, buildReviewMessage, reviewTone, type ClientReview } from "@/lib/admin/reviews"

type Copied = "message" | "link" | null

export function ReviewPanel({ client }: { client: ClientReview }) {
  const [copied, setCopied] = useState<Copied>(null)
  const [used, setUsed] = useState(false)
  const defaultMessage = buildReviewMessage(client.full_name)
  const [message, setMessage] = useState(defaultMessage)
  const isEmpty = message.trim().length === 0
  const isEdited = message !== defaultMessage
  const digits = client.whatsapp.replace(/\D/g, "")
  const messageId = `review-message-${client.id}`
  const alreadyRequested = Boolean(client.review_requested_at)
  const received = client.review_status === "recibida"

  async function copy(kind: Exclude<Copied, null>) {
    const ok = await navigator.clipboard
      .writeText(kind === "message" ? message : GOOGLE_REVIEW_URL)
      .then(() => true)
      .catch(() => false)
    if (!ok) return
    setCopied(kind)
    if (kind === "message") setUsed(true)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle aside={<Badge tone={reviewTone(client.review_status)}>{REVIEW_STATUS[client.review_status] ?? client.review_status}</Badge>}>
        Reseñas Google
      </SectionTitle>

      {alreadyRequested && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-amber-400/15 p-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Ya se solicitó {client.review_request_count > 1 ? `${client.review_request_count} veces` : "una reseña"}. Última:{" "}
            {formatDateTime(client.review_requested_at)}
            {client.review_requested_by_name ? ` por ${client.review_requested_by_name}` : ""}.
          </span>
        </p>
      )}

      {received && (
        <p className="rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Recibida el {formatDateTime(client.review_received_at)}
          {client.review_received_by_name ? ` · marcada por ${client.review_received_by_name}` : ""}
          {client.review_note ? ` · ${client.review_note}` : ""}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a
          href={isEmpty ? undefined : `https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={isEmpty}
          onClick={(event) => {
            if (isEmpty) {
              event.preventDefault()
              return
            }
            setUsed(true)
          }}
          className={`${primaryButtonClass} w-full sm:w-fit ${isEmpty ? "pointer-events-none opacity-50" : ""}`}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          Enviar por WhatsApp
        </a>
        <button
          type="button"
          onClick={() => copy("message")}
          disabled={isEmpty}
          className={`${secondaryButtonClass} w-full disabled:opacity-50 sm:w-fit`}
        >
          {copied === "message" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied === "message" ? "Mensaje copiado" : "Copiar mensaje"}
        </button>
        <button type="button" onClick={() => copy("link")} className={`${secondaryButtonClass} w-full sm:w-fit`}>
          {copied === "link" ? <Check className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
          {copied === "link" ? "Link copiado" : "Copiar link"}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={messageId} className="text-sm font-medium">
            Vista previa del mensaje
          </label>
          {isEdited && (
            <button
              type="button"
              onClick={() => setMessage(defaultMessage)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Restaurar original
            </button>
          )}
        </div>
        <textarea
          id={messageId}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={11}
          maxLength={2000}
          aria-describedby={`${messageId}-hint`}
          className={`${fieldClass} min-h-56 resize-y py-3 leading-relaxed`}
        />
        <p id={`${messageId}-hint`} className="text-xs text-muted-foreground">
          {isEmpty
            ? "Escribí un mensaje para poder enviarlo o copiarlo."
            : "Podés editarlo antes de enviarlo. WhatsApp y “Copiar mensaje” usan este texto."}
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {copied === "message" ? "Mensaje copiado al portapapeles" : copied === "link" ? "Link copiado al portapapeles" : ""}
      </p>

      {used && !received && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
          <p className="text-sm">¿Le enviaste el mensaje al cliente? Confirmalo para registrarlo.</p>
          <ActionForm
            action={setClientReview}
            submitLabel="Marcar como enviada"
            confirmText={alreadyRequested ? "Ya hay una solicitud registrada para este cliente. ¿Registrar otra?" : undefined}
            inline
          >
            <input type="hidden" name="client_id" value={client.id} />
            <input type="hidden" name="review_action" value="solicitada" />
          </ActionForm>
        </div>
      )}

      <div className="border-t border-border pt-4">
        {received ? (
          <ActionForm action={setClientReview} submitLabel="Deshacer reseña recibida" submitClassName={secondaryButtonClass} confirmText="¿Quitar la marca de reseña recibida?">
            <input type="hidden" name="client_id" value={client.id} />
            <input type="hidden" name="review_action" value="pendiente" />
          </ActionForm>
        ) : (
          <ActionForm
            action={setClientReview}
            submitLabel={
              <>
                <Star className="size-4" aria-hidden="true" />
                Marcar reseña recibida
              </>
            }
            submitClassName={secondaryButtonClass}
          >
            <input type="hidden" name="client_id" value={client.id} />
            <input type="hidden" name="review_action" value="recibida" />
            <Field label="Observación interna (opcional)" htmlFor={`review-note-${client.id}`}>
              <input id={`review-note-${client.id}`} name="note" maxLength={500} placeholder="Ej.: dejó 5 estrellas" className={fieldClass} />
            </Field>
          </ActionForm>
        )}
      </div>
    </Card>
  )
}
