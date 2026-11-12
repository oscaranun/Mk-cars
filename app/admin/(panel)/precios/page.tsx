import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin/auth"
import { saveLoyalty, savePriceList, type PriceRow } from "@/app/admin/(panel)/pro-actions"
import { ActionForm } from "@/components/admin/action-form"
import { Card, Field, PageHeader, SectionTitle, fieldClass } from "@/components/admin/ui"

export const metadata: Metadata = { title: "Precios y fidelidad" }

const EMPTY_ROWS = 3

export default async function PreciosPage() {
  const { supabase } = await requireAdmin()
  const { data } = await supabase.from("settings").select("service_prices, loyalty_every").eq("id", 1).maybeSingle()
  const prices = ((data?.service_prices as PriceRow[] | null) ?? []).filter((r) => r?.service)
  const rows: (PriceRow | null)[] = [...prices, ...Array.from({ length: EMPTY_ROWS }, () => null)]

  return (
    <>
      <PageHeader
        title="Precios y fidelidad"
        description="Al crear un turno o cobrar, el importe se completa solo según el servicio y el tipo de vehículo."
      />
      <Card className="flex flex-col gap-4">
        <SectionTitle>Lista de precios</SectionTitle>
        <ActionForm action={savePriceList} submitLabel="Guardar precios">
          <p className="text-xs text-muted-foreground">Para quitar un servicio, borrá su nombre y guardá.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-2">Servicio</th>
                  <th scope="col" className="py-2 pr-2">Auto</th>
                  <th scope="col" className="py-2 pr-2">SUV</th>
                  <th scope="col" className="py-2 pr-2">Pick-up</th>
                  <th scope="col" className="py-2">Pick-up XL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <input aria-label={`Servicio ${i + 1}`} name="service" defaultValue={r?.service ?? ""} maxLength={80} placeholder="Nuevo servicio" className={fieldClass} />
                    </td>
                    {(["auto", "suv", "pickup", "pickup_xl"] as const).map((k) => (
                      <td key={k} className="py-1 pr-2">
                        <input aria-label={`Precio ${k} fila ${i + 1}`} name={k} inputMode="numeric" defaultValue={String(r?.[k] ?? 0)} className={`${fieldClass} w-28`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      </Card>
      <Card className="flex flex-col gap-4">
        <SectionTitle>Tarjeta de fidelidad</SectionTitle>
        <p className="text-sm text-muted-foreground">Se cuenta sola con los lavados realizados y se ve en la ficha de cada cliente.</p>
        <ActionForm action={saveLoyalty} submitLabel="Guardar" inline>
          <Field label="Lavado gratis cada" htmlFor="loyalty_every">
            <input id="loyalty_every" name="loyalty_every" type="number" min={2} max={50} defaultValue={data?.loyalty_every ?? 6} className={`${fieldClass} w-24`} />
          </Field>
        </ActionForm>
      </Card>
    </>
  )
}
