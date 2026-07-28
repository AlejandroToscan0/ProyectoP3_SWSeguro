import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { modulesApi, menusApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type SafeMenu, type SafeModule } from "../types";

export function ModulesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<SafeModule[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission("MODULES_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    modulesApi
      .list()
      .then((result) => setModules(result.data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          navigate("/forbidden", { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : "Error al cargar módulos");
      });
  }, [hasPermission, navigate]);

  return (
    <section className="panel">
      <h2>Módulos</h2>
      <p className="muted">Unidades funcionales registradas en el Master.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => (
              <tr key={module.id}>
                <td>{module.nombre}</td>
                <td>{module.descripcion ?? "—"}</td>
                <td>{module.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MenusAdminPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<SafeMenu[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission("MENUS_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    menusApi
      .list()
      .then((result) => setMenus(result.data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          navigate("/forbidden", { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : "Error al cargar menús");
      });
  }, [hasPermission, navigate]);

  return (
    <section className="panel">
      <h2>Menús</h2>
      <p className="muted">Estructura Adjacency List administrable desde el Master.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>URL</th>
              <th>Orden</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {menus.map((menu) => (
              <tr key={menu.id}>
                <td>{menu.nombre}</td>
                <td>{menu.url ?? "—"}</td>
                <td>{menu.orden}</td>
                <td>{menu.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
