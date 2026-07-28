import type { MenuTreeNode } from "../types";

export function toAppPath(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `/app${url}` : `/app/${url}`;
}

export function asMenuNodes(nodes: MenuTreeNode[] | null | undefined): MenuTreeNode[] {
  return Array.isArray(nodes) ? nodes : [];
}

export type ModuleNavItem = {
  id: string;
  nombre: string;
  path: string;
  url: string;
  moduleId: string;
};

function walk(nodes: MenuTreeNode[] | null | undefined, visit: (node: MenuTreeNode) => void) {
  for (const node of asMenuNodes(nodes)) {
    visit(node);
    walk(node.children, visit);
  }
}

/** Menús con URL del mismo módulo que la ruta actual (para subnavegación). */
export function getModuleNavForPath(tree: MenuTreeNode[], pathname: string): ModuleNavItem[] {
  const normalized = pathname.replace(/\/+$/, "") || "/app";
  let moduleId: string | null = null;

  walk(tree, (node) => {
    const path = toAppPath(node.url);
    if (!path) return;
    const nodePath = path.replace(/\/+$/, "");
    if (normalized === nodePath || normalized.startsWith(`${nodePath}/`)) {
      moduleId = node.moduleId;
    }
  });

  if (!moduleId) {
    // Fallback: coincidencia por prefijo de URL en leaves (p. ej. /app/reservas/hoteles)
    walk(tree, (node) => {
      const path = toAppPath(node.url);
      if (!path) return;
      const nodePath = path.replace(/\/+$/, "");
      if (normalized.startsWith(nodePath) || nodePath.startsWith(normalized.split("/").slice(0, 3).join("/"))) {
        if (!moduleId) moduleId = node.moduleId;
      }
    });
  }

  // Si aún no hay match exacto, intenta módulo por primer segmento tras /app
  if (!moduleId) {
    const segment = normalized.replace(/^\/app\/?/, "").split("/")[0];
    if (segment) {
      walk(tree, (node) => {
        if (moduleId) return;
        const url = node.url?.replace(/^\//, "") ?? "";
        if (url === segment || url.startsWith(`${segment}/`)) {
          moduleId = node.moduleId;
        }
      });
    }
  }

  if (!moduleId) return [];

  const items: ModuleNavItem[] = [];
  const seen = new Set<string>();
  walk(tree, (node) => {
    if (node.moduleId !== moduleId || !node.url) return;
    const path = toAppPath(node.url);
    if (!path || seen.has(path)) return;
    seen.add(path);
    items.push({
      id: node.id,
      nombre: node.nombre,
      path,
      url: node.url,
      moduleId: node.moduleId,
    });
  });

  return items.sort((a, b) => a.url.localeCompare(b.url));
}

export function findMenuByPath(tree: MenuTreeNode[], pathname: string): MenuTreeNode | null {
  const normalized = pathname.replace(/\/+$/, "") || "/app";
  let best: MenuTreeNode | null = null;
  let bestLen = -1;

  walk(tree, (node) => {
    const path = toAppPath(node.url);
    if (!path) return;
    const nodePath = path.replace(/\/+$/, "");
    if (normalized === nodePath || normalized.startsWith(`${nodePath}/`)) {
      if (nodePath.length > bestLen) {
        best = node;
        bestLen = nodePath.length;
      }
    }
  });

  return best;
}
