import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type SafeUser } from "../types";

export function UsersPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission("USERS_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    usersApi
      .list()
      .then((result) => setUsers(result.data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          navigate("/forbidden", { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : "Error al cargar usuarios");
      });
  }, [hasPermission, navigate]);

  return (
    <section className="panel">
      <h2>Usuarios</h2>
      <p className="muted">Listado administrativo protegido por permiso USERS_READ.</p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.nombre}</td>
                <td>{user.email}</td>
                <td>{user.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
