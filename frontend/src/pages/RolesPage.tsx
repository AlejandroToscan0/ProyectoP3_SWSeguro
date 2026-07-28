import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { menusApi, modulesApi, permissionsApi, rolesApi, usersApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import {
  ApiError,
  type RoleDetail,
  type SafeMenu,
  type SafeModule,
  type SafePermission,
  type SafeRole,
  type SafeUser,
} from "../types";

const PRESETS: Record<string, { permissions: string[]; menuIds: string[]; moduleNames: string[] }> = {
  VENDEDOR: {
    permissions: ["AUTH_LOGIN", "AUTH_SELECT_ROLE", "VENTAS_READ", "VENTAS_CREATE", "RESERVAS_READ"],
    menuIds: ["menu-ventas"],
    moduleNames: ["Ventas", "Reservas"],
  },
  AUDITOR: {
    permissions: [
      "AUTH_LOGIN",
      "AUTH_SELECT_ROLE",
      "USERS_READ",
      "ROLES_READ",
      "MODULES_READ",
      "MENUS_READ",
      "VENTAS_READ",
      "RESERVAS_READ",
    ],
    menuIds: ["menu-usuarios", "menu-roles", "menu-modulos", "menu-menus", "menu-ventas"],
    moduleNames: ["Administración", "Ventas", "Reservas"],
  },
};

export function RolesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<SafeRole[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [permissions, setPermissions] = useState<SafePermission[]>([]);
  const [modules, setModules] = useState<SafeModule[]>([]);
  const [menus, setMenus] = useState<SafeMenu[]>([]);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [userToAssign, setUserToAssign] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canCreate = hasPermission("ROLES_CREATE");
  const canAssignUser = hasPermission("ROLES_ASSIGN_USER");
  const canRemoveUser = hasPermission("ROLES_REMOVE_USER");
  const canAssignPermission = hasPermission("ROLES_ASSIGN_PERMISSION");
  const canAssignModule = hasPermission("ROLES_ASSIGN_MODULE");
  const canAssignMenu = hasPermission("ROLES_ASSIGN_MENU");
  const canDelete = hasPermission("ROLES_DELETE");

  const assignedPermissionIds = useMemo(
    () => new Set(detail?.permissions.map((item) => item.id) ?? []),
    [detail],
  );
  const assignedModuleIds = useMemo(() => new Set(detail?.modules.map((item) => item.id) ?? []), [detail]);
  const assignedMenuIds = useMemo(() => new Set(detail?.menus.map((item) => item.id) ?? []), [detail]);
  const assignedUserIds = useMemo(() => new Set(detail?.users.map((item) => item.id) ?? []), [detail]);

  const assignableMenus = useMemo(() => {
    if (!detail) return [];
    return menus.filter((menu) => assignedModuleIds.has(menu.moduleId) || assignedMenuIds.has(menu.id));
  }, [menus, detail, assignedModuleIds, assignedMenuIds]);

  const loadCatalog = useCallback(async () => {
    const settled = await Promise.allSettled([
      rolesApi.list(),
      usersApi.list(),
      permissionsApi.list(),
      modulesApi.list(),
      menusApi.list(),
    ]);

    const [rolesRes, usersRes, permsRes, modulesRes, menusRes] = settled;
    const failures: string[] = [];

    if (rolesRes.status === "fulfilled") setRoles(rolesRes.value.data);
    else failures.push("roles");

    if (usersRes.status === "fulfilled") setUsers(usersRes.value.data);
    else failures.push("usuarios");

    if (permsRes.status === "fulfilled") setPermissions(permsRes.value.data);
    else failures.push("permisos");

    if (modulesRes.status === "fulfilled") setModules(modulesRes.value.data);
    else failures.push("módulos");

    if (menusRes.status === "fulfilled") setMenus(menusRes.value.data);
    else failures.push("menús");

    if (rolesRes.status === "rejected") {
      throw rolesRes.reason instanceof Error ? rolesRes.reason : new Error("Error al cargar roles");
    }

    if (failures.length > 0) {
      setError(`Catálogo parcial: no se pudieron cargar ${failures.join(", ")}`);
    }
  }, []);

  const loadDetail = useCallback(async (roleId: string) => {
    const data = await rolesApi.get(roleId);
    setDetail(data);
    setSelectedId(roleId);
  }, []);

  useEffect(() => {
    if (!hasPermission("ROLES_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    loadCatalog()
      .then((_) => undefined)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          navigate("/forbidden", { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : "Error al cargar roles");
      });
  }, [hasPermission, loadCatalog, navigate]);

  useEffect(() => {
    if (!selectedId && roles.length > 0) {
      void loadDetail(roles[0].id).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error al cargar detalle");
      });
    }
  }, [roles, selectedId, loadDetail]);

  async function refreshAll(roleId?: string) {
    await loadCatalog();
    const target = roleId ?? selectedId;
    if (target) {
      await loadDetail(target);
    }
  }

  async function onCreateRole(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const created = await rolesApi.create({
        nombre: nombre.trim(),
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      });
      setNombre("");
      setDescripcion("");
      setOk(`Rol ${created.nombre} creado`);
      await refreshAll(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el rol");
    } finally {
      setBusy(false);
    }
  }

  async function onAssignUser(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !userToAssign || !canAssignUser) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await rolesApi.assignUser(selectedId, userToAssign);
      setUserToAssign("");
      setOk("Usuario asignado al rol");
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar el usuario");
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveUser(userId: string) {
    if (!selectedId || !canRemoveUser) return;
    setBusy(true);
    setError(null);
    try {
      await rolesApi.removeUser(selectedId, userId);
      setOk("Usuario removido del rol");
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo remover el usuario");
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePermission(permission: SafePermission) {
    if (!selectedId || !canAssignPermission) return;
    if (assignedPermissionIds.has(permission.id)) {
      setOk("Para quitar permisos use soft-delete vía API/admin avanzada (aún no expuesto).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rolesApi.assignPermission(selectedId, permission.id);
      setOk(`Permiso ${permission.codigo} asignado`);
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar permiso");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleModule(module: SafeModule) {
    if (!selectedId || !canAssignModule) return;
    if (assignedModuleIds.has(module.id)) return;
    setBusy(true);
    setError(null);
    try {
      await rolesApi.assignModule(selectedId, module.id);
      setOk(`Módulo ${module.nombre} asignado`);
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar módulo");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleMenu(menu: SafeMenu) {
    if (!selectedId || !canAssignMenu) return;
    if (assignedMenuIds.has(menu.id)) return;
    setBusy(true);
    setError(null);
    try {
      await rolesApi.assignMenu(selectedId, menu.id);
      setOk(`Menú ${menu.nombre} asignado`);
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar menú");
    } finally {
      setBusy(false);
    }
  }

  async function applyPreset(presetName: keyof typeof PRESETS) {
    if (!selectedId) return;
    const preset = PRESETS[presetName];
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const permissionIds = permissions
        .filter((item) => preset.permissions.includes(item.codigo) && !assignedPermissionIds.has(item.id))
        .map((item) => item.id);
      const moduleIds = modules
        .filter((item) => preset.moduleNames.includes(item.nombre) && !assignedModuleIds.has(item.id))
        .map((item) => item.id);
      const menuIds = menus
        .filter((item) => preset.menuIds.includes(item.id) && !assignedMenuIds.has(item.id))
        .map((item) => item.id);

      await Promise.all([
        ...permissionIds.map((id) => rolesApi.assignPermission(selectedId, id)),
        ...moduleIds.map((id) => rolesApi.assignModule(selectedId, id)),
        ...menuIds.map((id) => rolesApi.assignMenu(selectedId, id)),
      ]);
      setOk(`Plantilla ${presetName} aplicada`);
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar la plantilla");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteRole() {
    if (!selectedId || !canDelete || !detail) return;
    if (!window.confirm(`¿Desactivar el rol ${detail.nombre}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await rolesApi.remove(selectedId);
      setOk(`Rol ${detail.nombre} desactivado`);
      setSelectedId(null);
      setDetail(null);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar el rol");
    } finally {
      setBusy(false);
    }
  }

  const availableUsers = users.filter((user) => !assignedUserIds.has(user.id));

  return (
    <section className="panel panel-wide">
      <div className="panel-heading">
        <div>
          <h2>Roles</h2>
          <p className="muted">Crea roles y asigna usuarios, permisos, módulos y menús en caliente.</p>
        </div>
        {canDelete && detail ? (
          <button type="button" className="button ghost danger" disabled={busy} onClick={() => void onDeleteRole()}>
            Soft delete
          </button>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {ok ? <p className="success-text">{ok}</p> : null}

      <div className="admin-grid">
        <div className="admin-column">
          {canCreate ? (
            <form className="stack-form" onSubmit={(event) => void onCreateRole(event)}>
              <h3>Nuevo rol</h3>
              <label>
                Nombre
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} />
              </label>
              <label>
                Descripción
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={500} />
              </label>
              <button className="button primary" type="submit" disabled={busy || !nombre.trim()}>
                Crear rol
              </button>
            </form>
          ) : null}

          <div className="role-list">
            <h3>Roles activos</h3>
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`role-chip ${selectedId === role.id ? "active" : ""}`}
                onClick={() => void loadDetail(role.id)}
              >
                <strong>{role.nombre}</strong>
                <span>{role.descripcion ?? "Sin descripción"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-column">
          {detail ? (
            <>
              <div className="detail-header">
                <h3>{detail.nombre}</h3>
                <p className="muted">{detail.descripcion ?? "Sin descripción"}</p>
              </div>

              <div className="preset-row">
                <span className="muted">Plantillas rápidas:</span>
                <button type="button" className="button ghost" disabled={busy} onClick={() => void applyPreset("VENDEDOR")}>
                  VENDEDOR
                </button>
                <button type="button" className="button ghost" disabled={busy} onClick={() => void applyPreset("AUDITOR")}>
                  AUDITOR
                </button>
              </div>

              <div className="assign-block">
                <h4>Usuarios ({detail.users.length})</h4>
                {canAssignUser ? (
                  <form className="inline-form" onSubmit={(event) => void onAssignUser(event)}>
                    <select value={userToAssign} onChange={(e) => setUserToAssign(e.target.value)} required>
                      <option value="">Seleccionar usuario…</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.nombre} ({user.email})
                        </option>
                      ))}
                    </select>
                    <button className="button primary" type="submit" disabled={busy || !userToAssign}>
                      Asignar
                    </button>
                  </form>
                ) : null}
                <ul className="chip-list">
                  {detail.users.map((user) => (
                    <li key={user.id}>
                      <span>
                        {user.nombre} · {user.email}
                      </span>
                      {canRemoveUser ? (
                        <button type="button" className="text-link" disabled={busy} onClick={() => void onRemoveUser(user.id)}>
                          Quitar
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="assign-block">
                <h4>Permisos ({detail.permissions.length})</h4>
                <div className="check-grid">
                  {permissions.map((permission) => {
                    const active = assignedPermissionIds.has(permission.id);
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        className={`check-chip ${active ? "on" : ""}`}
                        disabled={busy || !canAssignPermission || active}
                        onClick={() => void onTogglePermission(permission)}
                        title={permission.descripcion ?? permission.codigo}
                      >
                        {permission.codigo}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="assign-block">
                <h4>Módulos ({detail.modules.length})</h4>
                <div className="check-grid">
                  {modules.map((module) => {
                    const active = assignedModuleIds.has(module.id);
                    return (
                      <button
                        key={module.id}
                        type="button"
                        className={`check-chip ${active ? "on" : ""}`}
                        disabled={busy || !canAssignModule || active}
                        onClick={() => void onToggleModule(module)}
                      >
                        {module.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="assign-block">
                <h4>Menús ({detail.menus.length})</h4>
                <p className="muted">
                  Solo se listan menús de módulos ya asignados al rol. El lateral del usuario también exige el permiso de lectura.
                </p>
                <div className="check-grid">
                  {assignableMenus.map((menu) => {
                    const active = assignedMenuIds.has(menu.id);
                    const moduleReady = assignedModuleIds.has(menu.moduleId);
                    return (
                      <button
                        key={menu.id}
                        type="button"
                        className={`check-chip ${active ? "on" : ""}`}
                        disabled={busy || !canAssignMenu || active || !moduleReady}
                        onClick={() => void onToggleMenu(menu)}
                        title={!moduleReady ? "Asigna primero el módulo" : (menu.url ?? menu.nombre)}
                      >
                        {menu.nombre}
                        {menu.url ? ` (${menu.url})` : " (grupo)"}
                      </button>
                    );
                  })}
                  {assignableMenus.length === 0 ? (
                    <p className="muted">Asigna un módulo al rol para poder elegir sus menús.</p>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <p className="muted">Selecciona un rol para gestionar asignaciones.</p>
          )}
        </div>
      </div>
    </section>
  );
}
