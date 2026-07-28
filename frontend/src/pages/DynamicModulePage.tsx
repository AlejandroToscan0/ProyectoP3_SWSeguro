import { useMemo } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ModuleWorkspace } from "../components/ModuleWorkspace";
import { findMenuByPath, getModuleNavForPath } from "../menu/treeUtils";
import type { MenuTreeNode } from "../types";

type ShellContext = {
  tree: MenuTreeNode[];
};

export function DynamicModulePage() {
  const location = useLocation();
  const { role, permissions } = useAuth();
  const { tree = [] } = useOutletContext<ShellContext>() ?? { tree: [] };

  const moduleNav = useMemo(() => getModuleNavForPath(tree, location.pathname), [tree, location.pathname]);
  const current = useMemo(() => findMenuByPath(tree, location.pathname), [tree, location.pathname]);

  return (
    <ModuleWorkspace
      eyebrow="Catálogo dinámico"
      title={current?.nombre ?? "Módulo"}
      description="Los apartados visibles dependen de los menús asignados a tu rol activo."
      items={moduleNav}
    >
      {moduleNav.length === 0 ? (
        <div className="empty-state empty-state-error">
          <p className="error-text">Todavía no hay menús navegables para esta ruta.</p>
          <p className="muted">Crea menús en el módulo y asígnalos al rol desde Administración.</p>
        </div>
      ) : (
        <div className="module-section fade-in">
          <div className="info-grid">
            <article>
              <span>Ruta</span>
              <strong>
                <code>{location.pathname}</code>
              </strong>
            </article>
            <article>
              <span>Menú</span>
              <strong>{current?.nombre ?? "—"}</strong>
            </article>
            <article>
              <span>Rol</span>
              <strong>{role?.nombre ?? "—"}</strong>
            </article>
            <article>
              <span>Permisos</span>
              <strong className="info-grid-perms">{permissions.slice(0, 6).join(" · ") || "Sin permisos"}</strong>
            </article>
          </div>
        </div>
      )}
    </ModuleWorkspace>
  );
}
