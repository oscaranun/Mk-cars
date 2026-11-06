import { deletePhoto, uploadPhoto } from "@/app/admin/(panel)/pro-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Card, EmptyState, SectionTitle, fieldClass, secondaryButtonClass } from "@/components/admin/ui"
import { createServiceClient } from "@/lib/supabase/service"
import type { SupabaseClient } from "@supabase/supabase-js"

type Photo = { id: string; kind: "antes" | "despues"; path: string }

export async function AppointmentPhotos({ supabase, appointmentId }: { supabase: SupabaseClient; appointmentId: string }) {
  const { data } = await supabase
    .from("appointment_photos")
    .select("id, kind, path")
    .eq("appointment_id", appointmentId)
    .order("created_at")
  const photos = (data ?? []) as Photo[]
  const service = createServiceClient()
  const signed = new Map<string, string>()
  if (service && photos.length > 0) {
    const { data: urls } = await service.storage.from("lavados").createSignedUrls(photos.map((p) => p.path), 3600)
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl)
  }

  return (
    <Card className="flex flex-col gap-4 print:hidden">
      <SectionTitle>Fotos de antes y después</SectionTitle>
      {(["antes", "despues"] as const).map((kind) => {
        const list = photos.filter((p) => p.kind === kind)
        return (
          <div key={kind} className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">{kind === "antes" ? "Antes" : "Después"}</h3>
            {list.length === 0 ? (
              <EmptyState>Todavía no hay fotos.</EmptyState>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {list.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2">
                    {signed.get(p.path) ? (
                      <a href={signed.get(p.path)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed private URLs expire, so next/image caching does not apply */}
                        <img
                          src={signed.get(p.path)}
                          alt={`Foto ${kind === "antes" ? "antes" : "después"} del lavado`}
                          className="aspect-square w-full rounded-2xl object-cover"
                        />
                      </a>
                    ) : (
                      <div className="aspect-square rounded-2xl bg-surface" />
                    )}
                    <ActionForm action={deletePhoto} submitLabel="Borrar" submitClassName={secondaryButtonClass} confirmText="¿Borrar esta foto?">
                      <input type="hidden" name="photo_id" value={p.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={uploadPhoto} submitLabel="Subir foto" inline resetOnSuccess>
              <input type="hidden" name="appointment_id" value={appointmentId} />
              <input type="hidden" name="kind" value={kind} />
              <label className="sr-only" htmlFor={`photo-${kind}`}>
                Foto {kind}
              </label>
              <input
                id={`photo-${kind}`}
                name="photo"
                type="file"
                accept="image/*"
                capture="environment"
                required
                className={`${fieldClass} file:mr-3 file:rounded-full file:border-0 file:bg-primary/15 file:px-3 file:py-1 file:text-electric`}
              />
            </ActionForm>
          </div>
        )
      })}
    </Card>
  )
}
