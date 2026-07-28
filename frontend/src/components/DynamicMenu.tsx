import { NavLink } from "react-router-dom";
import type { MenuTreeNode } from "../types";

function toAppPath(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `/app${url}` : `/app/${url}`;
}

function MenuNodes({ nodes }: { nodes: MenuTreeNode[] }) {
  return (
    <ul className="menu-list">
      {nodes.map((node) => {
        const path = toAppPath(node.url);
        const hasChildren = node.children.length > 0;

        return (
          <li key={node.id} className="menu-item">
            {path ? (
              <NavLink to={path} className={({ isActive }) => (isActive ? "menu-link active" : "menu-link")}>
                {node.icono ? <span className="menu-icon">{node.icono}</span> : null}
                <span>{node.nombre}</span>
              </NavLink>
            ) : (
              <div className="menu-group">
                {node.icono ? <span className="menu-icon">{node.icono}</span> : null}
                <span>{node.nombre}</span>
              </div>
            )}
            {hasChildren ? <MenuNodes nodes={node.children} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function DynamicMenu({ tree }: { tree: MenuTreeNode[] }) {
  if (tree.length === 0) {
    return <p className="muted">No hay menús asignados a este rol.</p>;
  }

  return <MenuNodes nodes={tree} />;
}

export function flattenMenuLeaves(nodes: MenuTreeNode[]): Array<{ id: string; nombre: string; path: string }> {
  const leaves: Array<{ id: string; nombre: string; path: string }> = [];

  const walk = (items: MenuTreeNode[]) => {
    for (const item of items) {
      const path = toAppPath(item.url);
      if (path) {
        leaves.push({ id: item.id, nombre: item.nombre, path });
      }
      if (item.children.length > 0) {
        walk(item.children);
      }
    }
  };

  walk(nodes);
  return leaves;
}
