import { NavLink } from "react-router-dom";
import { canAccessMenuUrl } from "../menu/access";
import { asMenuNodes, toAppPath } from "../menu/treeUtils";
import type { MenuTreeNode } from "../types";

function filterTreeByPermissions(nodes: MenuTreeNode[], permissions: string[]): MenuTreeNode[] {
  const kept: MenuTreeNode[] = [];
  for (const node of asMenuNodes(nodes)) {
    const children = filterTreeByPermissions(node.children, permissions);
    const allowed = !node.url || canAccessMenuUrl(node.url, permissions);
    if (!allowed) continue;
    if (node.url || children.length > 0) {
      kept.push({ ...node, children });
    }
  }
  return kept;
}

function MenuNodes({ nodes }: { nodes: MenuTreeNode[] }) {
  return (
    <ul className="menu-list">
      {asMenuNodes(nodes).map((node) => {
        const path = toAppPath(node.url);
        const children = asMenuNodes(node.children);
        const hasChildren = children.length > 0;

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
            {hasChildren ? <MenuNodes nodes={children} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function DynamicMenu({ tree, permissions = [] }: { tree: MenuTreeNode[]; permissions?: string[] }) {
  const nodes = filterTreeByPermissions(asMenuNodes(tree), permissions);
  if (nodes.length === 0) {
    return <p className="muted">No hay menús asignados a este rol.</p>;
  }

  return <MenuNodes nodes={nodes} />;
}

export function flattenMenuLeaves(nodes: MenuTreeNode[]): Array<{ id: string; nombre: string; path: string }> {
  const leaves: Array<{ id: string; nombre: string; path: string }> = [];

  const walk = (items: MenuTreeNode[] | null | undefined) => {
    for (const item of asMenuNodes(items)) {
      const path = toAppPath(item.url);
      if (path) {
        leaves.push({ id: item.id, nombre: item.nombre, path });
      }
      walk(item.children);
    }
  };

  walk(nodes);
  return leaves;
}
