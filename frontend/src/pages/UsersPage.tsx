import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { rolesApi, usersApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type SafeRole, type SafeUser } from "../types";

export function UsersPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [roles, setRoles] = useState<SafeRole[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("ChangeMe123!");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission("USERS_CREATE");
  const canAssignRole = hasPermission("ROLES_ASSIGN_USER");

  async function load() {
    const [usersRes, rolesRes] = await Promise.all([usersApi.list(), rolesApi.list()]);
    setUsers(usersRes.data);
    setRoles(rolesRes.data);
    if (!roleId && rolesRes.data[0]) {
      setRoleId(rolesRes.data[0].id);
    }
  }

  useEffect(() => {
    if (!hasPermission("USERS_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    load().catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 403) {
        navigate("/forbidden", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, navigate]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const created = await usersApi.create({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      if (canAssignRole && roleId) {
        await rolesApi.assignUser(roleId, created.id);
      }
      setNombre("");
      setEmail("");
      setPassword("ChangeMe123!");
      setOk(
        canAssignRole && roleId
          ? `Usuario ${created.email} creado y asignado al rol seleccionado`
          : `Usuario ${created.email} creado`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-wide">
      <h2>Usuarios</h2>
      <p className="muted">Alta rápida de usuarios y asignación inicial de rol.</p>
      {error ? <p className="error-text">{error}</p> : null}
      {ok ? <p className="success-text">{ok}</p> : null}

      {canCreate ? (
        <form className="stack-form user-create" onSubmit={(event) => void onCreate(event)}>
          <h3>Nuevo usuario</h3>
          <div className="form-grid">
            <label>
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={255} />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </label>
            <label>
              Password
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            {canAssignRole ? (
              <label>
                Rol inicial
                <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <button className="button primary" type="submit" disabled={busy}>
            Crear usuario
          </button>
        </form>
      ) : null}

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
