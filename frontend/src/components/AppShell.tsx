import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { menusApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { DynamicMenu, flattenMenuLeaves } from "./DynamicMenu";
import { canAccessMenuUrl } from "../menu/access";
import { asMenuNodes } from "../menu/treeUtils";
import type { MenuTreeNode } from "../types";
import { ApiError } from "../types";

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

export function AppShell() {
  const { role, roles, permissions, logout, switchRole, refreshAvailableRoles } = useAuth();
  const navigate = useNavigate();
  const [tree, setTree] = useState<MenuTreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    function loadTree() {
      return menusApi
        .tree()
        .then((data) => {
          if (active) {
            setTree(Array.isArray(data) ? data : []);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!active) return;
          if (err instanceof ApiError && err.status === 401) {
            navigate(err.code === "TOKEN_EXPIRED" ? "/token-expired" : "/session-expired", { replace: true });
            return;
          }
          setTree([]);
          setError(err instanceof Error ? err.message : "No se pudo cargar el menú");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    void loadTree();
    void refreshAvailableRoles().catch(() => undefined);

    function onMenuRefresh() {
      void loadTree();
    }
    window.addEventListener("master:menu-refresh", onMenuRefresh);

    return () => {
      active = false;
      window.removeEventListener("master:menu-refresh", onMenuRefresh);
    };
  }, [navigate, role?.id, refreshAvailableRoles]);

  const visibleTree = useMemo(() => filterTreeByPermissions(tree, permissions), [tree, permissions]);
  const leaves = flattenMenuLeaves(visibleTree);
  const canSwitchRole = roles.length > 1;

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function onSwitchRole(roleId: string) {
    if (!roleId || roleId === role?.id || switching) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      await switchRole(roleId);
      navigate("/app", { replace: true });
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "No se pudo cambiar de rol");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand">Master Gateway</p>
          <p className="muted">Rol activo: {role?.nombre ?? "—"}</p>
        </div>

        {canSwitchRole ? (
          <div className="role-switcher">
            <label htmlFor="role-switch">
              Cambiar rol
              <select
                id="role-switch"
                value={role?.id ?? ""}
                disabled={switching}
                onChange={(event) => void onSwitchRole(event.target.value)}
              >
                {roles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </label>
            {switching ? <p className="muted">Cambiando contexto…</p> : null}
            {switchError ? <p className="error-text">{switchError}</p> : null}
          </div>
        ) : null}

        <nav aria-label="Menú dinámico">
          {loading ? <p className="muted">Cargando menú…</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {!loading && !error ? <DynamicMenu tree={visibleTree} permissions={permissions} /> : null}
          {!loading && !error && visibleTree.length === 0 ? (
            <p className="muted">Este rol no tiene menús asignados.</p>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <Link to="/app" className="text-link">
            Inicio
          </Link>
          <button type="button" className="button ghost" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="content-header">
          <div>
            <h1>Espacio de trabajo</h1>
            <p className="muted">Menú según rol · Zero Trust</p>
          </div>
          <div className="pill-row">
            {permissions.slice(0, 3).map((permission) => (
              <span key={permission} className="pill">
                {permission}
              </span>
            ))}
          </div>
        </header>

        <Outlet context={{ tree: visibleTree, leaves }} />
      </main>
    </div>
  );
}
