/**
 * Mapea rutas de menú SPA a permiso de lectura requerido.
 * Si no hay match, se usa `{PREFIJO_MODULO}_READ` a partir del nombre del módulo.
 */
const URL_READ_PERMISSIONS: Array<{ prefix: string; permission: string }> = [
  { prefix: "/usuarios", permission: "USERS_READ" },
  { prefix: "/roles", permission: "ROLES_READ" },
  { prefix: "/modulos", permission: "MODULES_READ" },
  { prefix: "/menus", permission: "MENUS_READ" },
  { prefix: "/ventas", permission: "VENTAS_READ" },
  { prefix: "/reservas", permission: "RESERVAS_READ" },
];

const KNOWN_MAPPED_PERMISSIONS = new Set(URL_READ_PERMISSIONS.map((item) => item.permission));

export function moduleNameToReadPermission(moduleNombre: string): string {
  const prefix = moduleNombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return prefix ? `${prefix}_READ` : "UNKNOWN_READ";
}

export function requiredReadPermissionForUrl(url: string | null | undefined, moduleNombre?: string | null): string | null {
  if (!url) return null;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  const hit = URL_READ_PERMISSIONS.find(
    (item) => normalized === item.prefix || normalized.startsWith(`${item.prefix}/`),
  );
  if (hit) return hit.permission;
  if (moduleNombre) return moduleNameToReadPermission(moduleNombre);
  return null;
}

/**
 * Decide si un menú con URL debe verse para el rol.
 * - Rutas conocidas (/usuarios, /ventas, /reservas…): exigen su permiso READ.
 * - Módulos nuevos: si `{MODULO}_READ` aún no existe en el catálogo, no ocultamos el menú.
 */
export function canAccessMenuUrl(
  url: string | null | undefined,
  rolePermissions: Iterable<string>,
  moduleNombre?: string | null,
  catalogPermissions?: Iterable<string> | null,
): boolean {
  if (!url) return true;
  const required = requiredReadPermissionForUrl(url, moduleNombre);
  if (!required) return true;

  const roleSet = rolePermissions instanceof Set ? rolePermissions : new Set(rolePermissions);
  if (roleSet.has(required)) return true;

  const isKnownMapped = KNOWN_MAPPED_PERMISSIONS.has(required);
  if (!isKnownMapped && catalogPermissions) {
    const catalog = catalogPermissions instanceof Set ? catalogPermissions : new Set(catalogPermissions);
    if (!catalog.has(required)) {
      // Permiso del módulo todavía no creado: mostrar el menú asignado.
      return true;
    }
  }

  if (!isKnownMapped && !catalogPermissions) return true;

  return false;
}
