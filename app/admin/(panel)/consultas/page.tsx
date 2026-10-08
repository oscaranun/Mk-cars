import type { Metadata } from "next"
import { updateInquiryStatus } from "@/app/admin/(panel)/crm-actions"
import { ActionForm } from "@/components/admin/action-form"
import {
  Badge,
  Card,
  EmptyState,
  ExportLink,
  Field,
  FilterBar,
  PageHeader,
  TextLink,
  fieldClass,
  secondaryButtonClass,
} from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
import { formatDateTime, resolveRange } from "@/lib/admin/format"
import { EDITABLE_INQUIRY_STATUSES, INQUIRY_STATUS, VEHICLE_CATEGORY, inquiryTone } from "@/lib/admin/labels"

export const metadata: Metadata = { title: "Consultas" }

type InquiryRow = {
  id: string
  created_at: string
  service: string
  extras: string[] | null
  source: string
  commercial_status: string
  notes: string | null
  clients: { id: string; full_name: string; whatsapp: string } | null
  vehicles: { category: string; brand: string | null; model: string | null } | null
}

type HistoryRow = { entity_id: string; from_status: string | null; to_status: string; changed_at: string }

type SearchParams = Promise<{ estado?: string; desde?: string; hasta?: string }>

export default async function InquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const range = resolveRange(params, 90)

  let query = supabase
    .from("inquiries")
    .select("id, created_at, service, extras, source, commercial_status, notes, clients(id, full_name, whatsapp), vehicles(category, brand, model)")
    .gte("created_at", range.fromISO)
    .lt("created_at", range.toISO)
    .order("created_at", { ascending: false })
    .limit(500)
  if (params.estado && INQUIRY_STATUS[params.estado]) query = query.eq("commercial_status", params.estado)

  const { data: inquiries } = await query.returns<InquiryRow[]>()
  const ids = (inquiries ?? []).map((i) => i.id)
  const { data: history } = ids.length
    ? await supabase
        .from("status_history")
        .select("entity_id, from_status, to_status, changed_at")
        .eq("entity", "inquiry")
        .in("entity_id", ids)
        .order("changed_at", { ascending: false })
        .returns<HistoryRow[]>()
    : { data: [] as HistoryRow[] }

  const historyById = new Map<string, HistoryRow[]>()
  for (const h of history ?? []) historyById.set(h.entity_id, [...(historyById.get(h.entity_id) ?? []), h])

  return (
    <>
      <PageHeader
        title="Consultas"
        description={`${inquiries?.length ?? 0} consulta${inquiries?.length === 1 ? "" : "s"} en el período`}
        actions={<ExportLink entity="consultas" query={{ desde: range.from, hasta: range.to }} />}
      />

      <FilterBar resetHref="/admin/consultas">
        <Field label="Estado" htmlFor="estado" className="md:w-56">
          <select id="estado" name="estado" defaultValue={params.estado ?? ""} className={fieldClass}>
            <option value="">Todos</option>
            {Object.entries(INQUIRY_STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Desde" htmlFor="desde" className="md:w-44">
          <input id="desde" name="desde" type="date" defaultValue={range.from} className={fieldClass} />
        </Field>
        <Field label="Hasta" htmlFor="hasta" className="md:w-44">
          <input id="hasta" name="hasta" type="date" defaultValue={range.to} className={fieldClass} />
        </Field>
      </FilterBar>

      {inquiries?.length ? (
        <ul className="flex flex-col gap-3">
          {inquiries.map((inq) => {
            const vehicle = inq.vehicles
              ? [VEHICLE_CATEGORY[inq.vehicles.category] ?? inq.vehicles.category, inq.vehicles.brand, inq.vehicles.model]
                  .filter(Boolean)
                  .join(" ")
              : null
            const log = historyById.get(inq.id) ?? []
            const editable = (EDITABLE_INQUIRY_STATUSES as readonly string[]).includes(inq.commercial_status)
            return (
              <li key={inq.id}>
                <Card className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {inq.clients ? (
                          <TextLink href={`/admin/clientes/${inq.clients.id}`}>{inq.clients.full_name}</TextLink>
                        ) : (
                          <span className="font-medium">Cliente</span>
                        )}
                        <Badge tone={inquiryTone(inq.commercial_status)}>
                          {INQUIRY_STATUS[inq.commercial_status] ?? inq.commercial_status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {formatDateTime(inq.created_at)} · Origen: {inq.source}
                      </p>
                      <p className="text-sm">
                        {inq.service}
                        {inq.extras?.length ? ` + ${inq.extras.join(", ")}` : ""}
                        {vehicle ? <span className="text-muted-foreground"> · {vehicle}</span> : null}
                      </p>
                      {inq.notes && <p className="text-sm text-muted-foreground">{inq.notes}</p>}
                    </div>

                    <ActionForm
                      action={updateInquiryStatus}
                      submitLabel="Guardar"
                      submitClassName={secondaryButtonClass}
                      inline
                      className="md:max-w-sm md:justify-end"
                    >
                      <input type="hidden" name="id" value={inq.id} />
                      <label htmlFor={`status-${inq.id}`} className="sr-only">
                        Estado comercial
                      </label>
                      <select
                        id={`status-${inq.id}`}
                        name="status"
                        defaultValue={editable ? inq.commercial_status : ""}
                        required
                        className={`${fieldClass} md:w-60`}
                      >
                        {!editable && (
                          <option value="" disabled>
                            Cambiar estado…
                          </option>
                        )}
                        {EDITABLE_INQUIRY_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {INQUIRY_STATUS[s]}
                          </option>
                        ))}
                      </select>
                    </ActionForm>
                  </div>

                  {log.length > 0 && (
                    <details className="group rounded-2xl bg-surface px-4 py-3 text-sm">
                      <summary className="cursor-pointer text-muted-foreground marker:text-electric">
                        Historial de cambios ({log.length})
                      </summary>
                      <ol className="mt-3 flex flex-col gap-1.5">
                        {log.map((h, idx) => (
                          <li key={idx} className="flex flex-wrap gap-x-2 tabular-nums text-muted-foreground">
                            <span>{formatDateTime(h.changed_at)}</span>
                            <span className="text-foreground">
                              {h.from_status ? `${INQUIRY_STATUS[h.from_status] ?? h.from_status} → ` : "Creada como "}
                              {INQUIRY_STATUS[h.to_status] ?? h.to_status}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState>No hay consultas en el período seleccionado.</EmptyState>
      )}
    </>
  )
}
