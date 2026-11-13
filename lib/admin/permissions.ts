export type NavGroup = "operacion" | "clientes" | "finanzas" | "config"

export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: "operacion", label: "Operación" },
  { key: "clientes", label: "Clientes" },
  { key: "finanzas", label: "Finanzas" },
  { key: "config", label: "Configuración" },
]

type Section = { key: string; href: string; label: string; group?: NavGroup; hidden?: boolean }

/**
 * Order defines the sidebar. `hidden` sections keep their route, data and permission
 * key (links from other screens still work) but no longer appear in the menu.
 */
export const SECTIONS: readonly Section[] = [
  { key: "hoy", href: "/admin", label: "Hoy", group: "operacion" },
  { key: "tablero", href: "/admin/tablero", label: "Tablero", group: "operacion" },
  { key: "consultas", href: "/admin/consultas", label: "Consultas", group: "operacion" },
  { key: "agenda", href: "/admin/agenda", label: "Agenda", group: "operacion" },
  { key: "recorrido", href: "/admin/recorrido", label: "Mi recorrido", group: "operacion" },
  { key: "tareas", href: "/admin/tareas", label: "Tareas", group: "operacion" },
  { key: "clientes", href: "/admin/clientes", label: "Clientes", group: "clientes" },
  { key: "recontactar", href: "/admin/recontactar", label: "Recontactar", group: "clientes" },
  { key: "campanas", href: "/admin/campanas", label: "Campañas y cupones", group: "clientes" },
  { key: "eventos", href: "/admin/eventos", label: "Flyers de eventos", group: "clientes" },
  { key: "movimientos", href: "/admin/movimientos", label: "Movimientos", group: "finanzas" },
  { key: "cobros", href: "/admin/cobros", label: "Ingresos", group: "finanzas" },
  { key: "caja", href: "/admin/caja", label: "Egresos", group: "finanzas" },
  { key: "gastos-fijos", href: "/admin/gastos-fijos", label: "Gastos fijos", group: "finanzas" },
  { key: "cierre", href: "/admin/cierre", label: "Cierre de caja", group: "finanzas" },
  { key: "estadisticas", href: "/admin/estadisticas", label: "Estadísticas", group: "finanzas" },
  { key: "servicios", href: "/admin/servicios", label: "Reportes", group: "finanzas" },
  { key: "configuracion", href: "/admin/configuracion", label: "Ajustes", group: "config" },
  { key: "actividad", href: "/admin/actividad", label: "Historial de cambios", group: "config" },
  { key: "turnos", href: "/admin/turnos", label: "Turnos", hidden: true },
  { key: "precios", href: "/admin/precios", label: "Lista de precios", hidden: true },
  { key: "agenda-servicios", href: "/admin/agenda-servicios", label: "Agenda de servicios", hidden: true },
  { key: "zonas", href: "/admin/zonas", label: "Zonas y recorridos", hidden: true },
  { key: "pruebas", href: "/admin/pruebas", label: "Pruebas", hidden: true },
]

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
