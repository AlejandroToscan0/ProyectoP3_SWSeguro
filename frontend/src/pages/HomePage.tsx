import { useOutletContext } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { MenuTreeNode } from "../types";

type ShellContext = {
  tree: MenuTreeNode[];
  leaves: Array<{ id: string; nombre: string; path: string }>;
};

export function HomePage() {
  const { role, permissions } = useAuth();
  const { leaves } = useOutletContext<ShellContext>();

  return (
    <section className="panel">
      <h2>Bienvenido</h2>
      <p className="muted">
        Sesión activa con el rol <strong>{role?.nombre}</strong>. Las rutas visibles se generan desde
        <code> GET /api/menus/tree</code>.
      </p>

      <div className="stats">
        <article>
          <span className="muted">Permisos en JWT</span>
          <strong>{permissions.length}</strong>
        </article>
        <article>
          <span className="muted">Ítems navegables</span>
          <strong>{leaves.length}</strong>
        </article>
      </div>

      <h3>Rutas disponibles para este rol</h3>
      <ul className="plain-list">
        {leaves.map((leaf) => (
          <li key={leaf.id}>
            <code>{leaf.path}</code> — {leaf.nombre}
          </li>
        ))}
      </ul>
    </section>
  );
}
