import type { Metadata } from "next"
import { CompletedServiceForm } from "@/components/admin/completed-service-form"
import { Card, PageHeader, TextLink } from "@/components/admin/ui"
import { requireAdmin } from "@/lib/admin/auth"
export const metadata: Metadata = {title:"Cargar lavado realizado"}
export default async function CompletedServicePage() {
 await requireAdmin()
 return <><PageHeader title="Cargar lavado realizado" description="Registrá trabajos de hoy o de días anteriores, con cobro total, parcial o pendiente. No se envían notificaciones." actions={<TextLink href="/admin/clientes">Volver a clientes</TextLink>}/><Card><CompletedServiceForm/></Card></>
}
