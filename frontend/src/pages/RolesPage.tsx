import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rolesApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type SafeRole } from "../types";

export function RolesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<SafeRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission("ROLES_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    rolesApi
      .list()
      .then((result) => setRoles(result.data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          navigate("/forbidden", { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : "Error al cargar roles");
      });
  }, [hasPermission, navigate]);

  return (
    <section className="panel">
      <h2>Roles</h2>
      <p className="muted">Gestión de roles del Master Gateway.</p>
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
            {roles.map((role) => (
              <tr key={role.id}>
                <td>{role.nombre}</td>
                <td>{role.descripcion ?? "—"}</td>
                <td>{role.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
