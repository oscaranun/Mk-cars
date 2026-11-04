export const SECTIONS = [
  { key: "hoy", href: "/admin", label: "Hoy" },
  { key: "agenda", href: "/admin/agenda", label: "Agenda" },
  { key: "agenda-servicios", href: "/admin/agenda-servicios", label: "Agenda de servicios" },
  { key: "zonas", href: "/admin/zonas", label: "Zonas y recorridos" },
  { key: "turnos", href: "/admin/turnos", label: "Turnos" },
  { key: "clientes", href: "/admin/clientes", label: "Clientes" },
  { key: "recontactar", href: "/admin/recontactar", label: "Recontactar" },
  { key: "consultas", href: "/admin/consultas", label: "Consultas" },
  { key: "servicios", href: "/admin/servicios", label: "Servicios" },
  { key: "cobros", href: "/admin/cobros", label: "Cobros" },
  { key: "caja", href: "/admin/caja", label: "Caja" },
  { key: "estadisticas", href: "/admin/estadisticas", label: "Estadísticas" },
  { key: "pruebas", href: "/admin/pruebas", label: "Pruebas" },
] as const

export const USERS_SECTION = { key: "usuarios", href: "/admin/usuarios", label: "Usuarios" } as const

export const SECTION_KEYS: string[] = SECTIONS.map((s) => s.key)

export type AdminRole = "owner" | "staff"
export type AdminProfile = { role: AdminRole; permissions: string[]; full_name: string | null }

export function sectionForPath(pathname: string): string | null {
  if (pathname === USERS_SECTION.href || pathname.startsWith(`${USERS_SECTION.href}/`)) return USERS_SECTION.key
  for (const s of SECTIONS) {
    if (s.href === "/admin" ? pathname === "/admin" : pathname === s.href || pathname.startsWith(`${s.href}/`)) {
      return s.key
    }
  }
  return null
}

export function canAccess(profile: AdminProfile | null, key: string | null) {
  if (!profile) return false
  if (profile.role === "owner") return true
  if (key === USERS_SECTION.key) return false
  if (key === null) return true
  return profile.permissions.includes(key)
}

export function allowedKeys(profile: AdminProfile | null): string[] {
  if (!profile) return []
  if (profile.role === "owner") return [...SECTION_KEYS, USERS_SECTION.key]
  return SECTION_KEYS.filter((k) => profile.permissions.includes(k))
}
