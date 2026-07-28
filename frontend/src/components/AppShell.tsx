import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { menusApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { DynamicMenu, flattenMenuLeaves } from "./DynamicMenu";
import type { MenuTreeNode } from "../types";
import { ApiError } from "../types";

export function AppShell() {
  const { role, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const [tree, setTree] = useState<MenuTreeNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    menusApi
      .tree()
      .then((data) => {
        if (active) {
          setTree(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate(err.code === "TOKEN_EXPIRED" ? "/token-expired" : "/session-expired", { replace: true });
          return;
        }
        // No expulsar a /forbidden: el shell debe seguir usable (inicio + logout).
        setTree([]);
        setError(err instanceof Error ? err.message : "No se pudo cargar el menú");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  const leaves = flattenMenuLeaves(tree);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand">Master Gateway</p>
          <p className="muted">Rol activo: {role?.nombre ?? "—"}</p>
        </div>

        <nav aria-label="Menú dinámico">
          {loading ? <p className="muted">Cargando menú…</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {!loading && !error ? <DynamicMenu tree={tree} /> : null}
          {!loading && !error && tree.length === 0 ? (
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
            <p className="muted">La navegación se construye desde el backend según el rol seleccionado.</p>
          </div>
          <div className="pill-row">
            {permissions.slice(0, 4).map((permission) => (
              <span key={permission} className="pill">
                {permission}
              </span>
            ))}
          </div>
        </header>

        <Outlet context={{ tree, leaves }} />
      </main>
    </div>
  );
}
