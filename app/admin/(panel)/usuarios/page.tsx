import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { EmptyState, PageHeader, SectionTitle } from "@/components/admin/ui"
import { UserCard, type PanelUser } from "@/components/admin/users/user-card"
import { UserCreateForm } from "@/components/admin/users/user-create-form"
import { requireAdmin } from "@/lib/admin/auth"
import { createServiceClient } from "@/lib/supabase/service"

export const metadata: Metadata = { title: "Usuarios" }

export default async function UsersPage() {
  const { user, profile } = await requireAdmin()
  if (profile?.role !== "owner") redirect("/admin")

  const service = createServiceClient()
  if (!service) return <EmptyState>Falta configurar la clave de servicio de Supabase.</EmptyState>

  const [{ data: admins }, { data: authList }] = await Promise.all([
    service.from("admins").select("user_id, full_name, role, permissions, created_at").order("created_at"),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emails = new Map((authList?.users ?? []).map((u) => [u.id, { email: u.email ?? "", lastSignIn: u.last_sign_in_at ?? null }]))
  const users: PanelUser[] = (admins ?? []).map((a) => ({
    id: a.user_id,
    fullName: a.full_name,
    email: emails.get(a.user_id)?.email ?? "",
    lastSignIn: emails.get(a.user_id)?.lastSignIn ?? null,
    role: a.role,
    permissions: a.permissions ?? [],
    isSelf: a.user_id === user.id,
  }))

  return (
    <>
      <PageHeader
        title="Usuarios y permisos"
        description="Creá accesos al panel, elegí qué secciones ve cada persona y enviá un mail para cambiar la contraseña."
      />
      <section className="flex flex-col gap-4" aria-labelledby="nuevo-usuario">
        <SectionTitle>
          <span id="nuevo-usuario">Nuevo usuario</span>
        </SectionTitle>
        <UserCreateForm />
      </section>
      <section className="flex flex-col gap-4" aria-labelledby="lista-usuarios">
        <SectionTitle aside={<span className="text-sm text-muted-foreground">{users.length}</span>}>
          <span id="lista-usuarios">Usuarios del panel</span>
        </SectionTitle>
        {users.length === 0 ? (
          <EmptyState>No hay usuarios todavía.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {users.map((u) => (
              <li key={u.id}>
                <UserCard user={u} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
