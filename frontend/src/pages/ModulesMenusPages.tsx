import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { menusApi, modulesApi, permissionsApi, rolesApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type SafeMenu, type SafeModule, type SafePermission, type SafeRole } from "../types";

function slugifyPath(nombre: string): string {
  const slug = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `/${slug}` : "/modulo";
}

function permissionPrefix(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function hostLabel(baseUrl: string | null): string {
  if (!baseUrl) return "Sin URL configurada";
  try {
    const url = new URL(baseUrl);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return baseUrl;
  }
}

type HealthState = "idle" | "checking" | "up" | "down";

export function ModulesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [modules, setModules] = useState<SafeModule[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moduleMenus, setModuleMenus] = useState<SafeMenu[]>([]);
  const [permissions, setPermissions] = useState<SafePermission[]>([]);
  const [roles, setRoles] = useState<SafeRole[]>([]);
  const [roleDetailPermIds, setRoleDetailPermIds] = useState<Set<string>>(new Set());

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [healthPath, setHealthPath] = useState("/health");
  const [roleId, setRoleId] = useState("");

  const [editDescripcion, setEditDescripcion] = useState("");
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editHealthPath, setEditHealthPath] = useState("");

  const [menuNombre, setMenuNombre] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuOrden, setMenuOrden] = useState(10);
  const [menuParentId, setMenuParentId] = useState("");
  const [menuAsGroup, setMenuAsGroup] = useState(false);

  const [health, setHealth] = useState<HealthState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission("MODULES_CREATE");
  const canUpdate = hasPermission("MODULES_UPDATE");
  const canDelete = hasPermission("MODULES_DELETE");
  const canCreateMenu = hasPermission("MENUS_CREATE");
  const canDeleteMenu = hasPermission("MENUS_DELETE");
  const canAssignMenu = hasPermission("ROLES_ASSIGN_MENU");
  const canAssignPermission = hasPermission("ROLES_ASSIGN_PERMISSION");
  const canAssignModule = hasPermission("ROLES_ASSIGN_MODULE");

  const selected = useMemo(
    () => modules.find((item) => item.id === selectedId) ?? null,
    [modules, selectedId],
  );
  const prefix = selected ? permissionPrefix(selected.nombre) : "";
  const modulePermissions = useMemo(
    () => permissions.filter((item) => item.codigo.startsWith(`${prefix}_`)),
    [permissions, prefix],
  );

  const loadCatalog = useCallback(async () => {
    const [modulesRes, permsRes, rolesRes] = await Promise.all([
      modulesApi.list(),
      permissionsApi.list(),
      rolesApi.list(),
    ]);
    setModules(modulesRes.data);
    setPermissions(permsRes.data);
    setRoles(rolesRes.data);
    setRoleId((current) => current || rolesRes.data[0]?.id || "");
    setSelectedId((current) => current || modulesRes.data[0]?.id || null);
  }, []);

  const loadSelectedExtras = useCallback(
    async (moduleId: string, currentRoleId: string) => {
      const menusRes = await menusApi.list({ moduleId });
      setModuleMenus(menusRes.data);
      if (currentRoleId) {
        const detail = await rolesApi.get(currentRoleId);
        setRoleDetailPermIds(new Set(detail.permissions.map((item) => item.id)));
      }
    },
    [],
  );

  useEffect(() => {
    if (!hasPermission("MODULES_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }
    loadCatalog().catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 403) {
        navigate("/forbidden", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Error al cargar módulos");
    });
  }, [hasPermission, navigate, loadCatalog]);

  useEffect(() => {
    if (!selected) {
      setEditDescripcion("");
      setEditBaseUrl("");
      setEditHealthPath("");
      setModuleMenus([]);
      setHealth("idle");
      return;
    }
    setEditDescripcion(selected.descripcion ?? "");
    setEditBaseUrl(selected.baseUrl ?? "");
    setEditHealthPath(selected.healthPath ?? "/health");
    setMenuUrl(slugifyPath(selected.nombre));
    setMenuNombre(selected.nombre);
    setMenuParentId("");
    setMenuAsGroup(false);
    void loadSelectedExtras(selected.id, roleId).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Error al cargar detalle del módulo");
    });
  }, [selected, roleId, loadSelectedExtras]);

  async function checkHealth(module: SafeModule) {
    if (!module.baseUrl) {
      setHealth("idle");
      return;
    }
    setHealth("checking");
    const path = module.healthPath || "/health";
    try {
      const response = await fetch(`${module.baseUrl.replace(/\/$/, "")}${path}`, {
        method: "GET",
        cache: "no-store",
      });
      setHealth(response.ok ? "up" : "down");
    } catch {
      setHealth("down");
    }
  }

  useEffect(() => {
    if (selected?.baseUrl) {
      void checkHealth(selected);
    } else {
      setHealth("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.baseUrl, selected?.healthPath]);

  async function onCreateModule(event: FormEvent) {
    event.preventDefault();
    if (!canCreate || !nombre.trim()) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const created = await modulesApi.create({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        baseUrl: baseUrl.trim() || null,
        healthPath: healthPath.trim() || null,
      });
      if (roleId && canAssignModule) {
        try {
          await rolesApi.assignModule(roleId, created.id);
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 409)) throw err;
        }
      }
      setNombre("");
      setDescripcion("");
      setBaseUrl("");
      setHealthPath("/health");
      setOk(`Módulo “${created.nombre}” creado. Ahora puedes añadir menú y permisos en el panel derecho.`);
      await loadCatalog();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el módulo");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveInfo(event: FormEvent) {
    event.preventDefault();
    if (!selected || !canUpdate) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const updated = await modulesApi.update(selected.id, {
        descripcion: editDescripcion.trim() || null,
        baseUrl: editBaseUrl.trim() || null,
        healthPath: editHealthPath.trim() || null,
      });
      setOk("Información del servicio actualizada");
      await loadCatalog();
      setSelectedId(updated.id);
      await checkHealth(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el módulo");
    } finally {
      setBusy(false);
    }
  }

  async function ensureReadPermissionForRole() {
    if (!selected || !roleId || !canAssignPermission) return;
    const codigo = `${permissionPrefix(selected.nombre)}_READ`;
    let permission = permissions.find((item) => item.codigo === codigo) ?? null;
    if (!permission) {
      try {
        permission = await permissionsApi.create({
          codigo,
          descripcion: `Lectura del módulo ${selected.nombre}`,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const catalog = await permissionsApi.list();
          permission = catalog.data.find((item) => item.codigo === codigo) ?? null;
          setPermissions(catalog.data);
        } else {
          throw err;
        }
      }
    }
    if (permission) {
      try {
        await rolesApi.assignPermission(roleId, permission.id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 409)) throw err;
      }
    }
  }

  async function assignMenuIfNeeded(menuId: string) {
    if (!roleId || !canAssignMenu) return;
    if (selected && canAssignModule) {
      try {
        await rolesApi.assignModule(roleId, selected.id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 409)) {
          // Si falla por otra razón, assignMenu devolverá el error definitivo.
        }
      }
    }
    try {
      await ensureReadPermissionForRole();
    } catch {
      // El menú igual se asigna; el árbol puede mostrarlo si el permiso aún no existe.
    }
    try {
      await rolesApi.assignMenu(roleId, menuId);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err;
    }
  }

  async function onCreateMenu(event: FormEvent) {
    event.preventDefault();
    if (!selected || !canCreateMenu || !menuNombre.trim()) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const url = menuAsGroup ? null : (menuUrl.trim() || slugifyPath(selected.nombre)).slice(0, 500);
      const created = await menusApi.create({
        nombre: menuNombre.trim(),
        url,
        moduleId: selected.id,
        parentId: menuParentId || null,
        orden: Number.isFinite(menuOrden) ? menuOrden : 10,
      });
      await assignMenuIfNeeded(created.id);
      setOk(
        menuAsGroup
          ? `Grupo “${created.nombre}” creado. Ahora añade apartados hijos con URL.`
          : `Menú “${created.nombre}” creado${roleId ? " y asignado al rol" : ""}`,
      );
      setMenuAsGroup(false);
      await loadSelectedExtras(selected.id, roleId);
      window.dispatchEvent(new Event("master:menu-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el menú");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateReservasSections() {
    if (!selected || !canCreateMenu) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const existing = moduleMenus;
      let parent =
        existing.find((item) => !item.url && item.nombre.toLowerCase().includes("reserva")) ??
        existing.find((item) => !item.url) ??
        null;

      // Si solo hay un menú hoja /reservas, no puede ser padre: creamos un grupo nuevo.
      if (!parent) {
        parent = await menusApi.create({
          nombre: "Módulo Reservas",
          url: null,
          moduleId: selected.id,
          orden: 10,
        });
        await assignMenuIfNeeded(parent.id);
      }

      const sections = [
        { nombre: "Resumen", url: "/reservas", orden: 11 },
        { nombre: "Hoteles", url: "/reservas/hoteles", orden: 12 },
        { nombre: "Huéspedes", url: "/reservas/huespedes", orden: 13 },
        { nombre: "Reservaciones", url: "/reservas/reservaciones", orden: 14 },
      ];

      const createdNames: string[] = [];
      for (const section of sections) {
        const already = existing.some((item) => item.url === section.url);
        if (already) {
          // Reasignar al rol por si faltaba
          const found = existing.find((item) => item.url === section.url);
          if (found) await assignMenuIfNeeded(found.id);
          continue;
        }
        const created = await menusApi.create({
          nombre: section.nombre,
          url: section.url,
          moduleId: selected.id,
          parentId: parent.id,
          orden: section.orden,
        });
        await assignMenuIfNeeded(created.id);
        createdNames.push(created.nombre);
      }

      setOk(
        createdNames.length > 0
          ? `Apartados creados: ${createdNames.join(", ")}. Usa el menú lateral o la barra de apartados dentro del módulo.`
          : "Los apartados de Reservas ya existían y quedaron asignados al rol.",
      );
      await loadSelectedExtras(selected.id, roleId);
      window.dispatchEvent(new Event("master:menu-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron crear los apartados");
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveMenu(menu: SafeMenu) {
    if (!canDeleteMenu || !selected) return;
    if (!window.confirm(`¿Quitar el menú “${menu.nombre}” del lateral?`)) return;
    setBusy(true);
    try {
      await menusApi.remove(menu.id);
      setOk(`Menú “${menu.nombre}” desactivado`);
      await loadSelectedExtras(selected.id, roleId);
      window.dispatchEvent(new Event("master:menu-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el menú");
    } finally {
      setBusy(false);
    }
  }

  async function ensureModulePermissions() {
    if (!selected || !canAssignPermission) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const codes = [`${prefix}_READ`, `${prefix}_CREATE`];
      for (const codigo of codes) {
        let permission = permissions.find((item) => item.codigo === codigo) ?? null;
        if (!permission) {
          try {
            permission = await permissionsApi.create({
              codigo,
              descripcion: `Permiso del módulo ${selected.nombre}`,
            });
          } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
              const catalog = await permissionsApi.list();
              permission = catalog.data.find((item) => item.codigo === codigo) ?? null;
            } else {
              throw err;
            }
          }
        }
        if (permission && roleId) {
          try {
            await rolesApi.assignPermission(roleId, permission.id);
          } catch (err) {
            if (!(err instanceof ApiError && err.status === 409)) throw err;
          }
        }
      }
      const catalog = await permissionsApi.list();
      setPermissions(catalog.data);
      await loadSelectedExtras(selected.id, roleId);
      setOk(
        `Permisos ${codes.join(", ")} listos. Cierra sesión y vuelve a elegir el rol para refrescar el JWT.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron preparar los permisos");
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePermission(permission: SafePermission) {
    if (!canAssignPermission || !roleId) return;
    setBusy(true);
    setError(null);
    try {
      if (roleDetailPermIds.has(permission.id)) {
        await rolesApi.removePermission(roleId, permission.id);
        setOk(`Permiso ${permission.codigo} quitado del rol`);
      } else {
        await rolesApi.assignPermission(roleId, permission.id);
        setOk(`Permiso ${permission.codigo} asignado al rol`);
      }
      await loadSelectedExtras(selected!.id, roleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo editar el permiso");
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveModule(module: SafeModule) {
    if (!canDelete) return;
    if (!window.confirm(`¿Desincorporar “${module.nombre}”? Se desactivarán menús y asignaciones.`)) return;
    setBusy(true);
    try {
      await modulesApi.remove(module.id);
      setOk(`Módulo “${module.nombre}” desincorporado`);
      setSelectedId(null);
      await loadCatalog();
      window.dispatchEvent(new Event("master:menu-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desincorporar");
    } finally {
      setBusy(false);
    }
  }

  function fillReservasDemo() {
    setNombre("Reservas");
    setDescripcion("Microservicio hotel/reservas");
    setBaseUrl("http://localhost:3002");
    setHealthPath("/api/stats");
    const admin = roles.find((role) => role.nombre === "ADMIN");
    if (admin) setRoleId(admin.id);
  }

  const healthLabel =
    health === "up" ? "En línea" : health === "down" ? "Sin respuesta" : health === "checking" ? "Comprobando…" : "—";

  return (
    <section className="panel panel-wide">
      <h2>Módulos</h2>
      <p className="muted">
        Incorpora un microservicio, configura dónde corre, crea sus menús y ajusta los permisos del rol.
      </p>
      {error ? <p className="error-text">{error}</p> : null}
      {ok ? <p className="success-text">{ok}</p> : null}

      <div className="admin-grid">
        <div className="admin-column">
          {canCreate ? (
            <form className="stack-form" onSubmit={(event) => void onCreateModule(event)}>
              <div className="panel-heading">
                <h3>Incorporar módulo</h3>
                <button type="button" className="button ghost" disabled={busy} onClick={fillReservasDemo}>
                  Demo Reservas
                </button>
              </div>
              <label>
                Nombre
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={100} />
              </label>
              <label>
                Descripción
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={500} />
              </label>
              <label>
                URL del servicio
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:3002"
                  maxLength={500}
                />
              </label>
              <label>
                Health path
                <input
                  value={healthPath}
                  onChange={(e) => setHealthPath(e.target.value)}
                  placeholder="/health"
                  maxLength={200}
                />
              </label>
              {roles.length > 0 ? (
                <label>
                  Asignar módulo al rol
                  <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button className="button primary" type="submit" disabled={busy || !nombre.trim()}>
                Crear módulo
              </button>
            </form>
          ) : null}

          <div className="role-list">
            <h3>Activos</h3>
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                className={`role-chip ${selectedId === module.id ? "active" : ""}`}
                onClick={() => setSelectedId(module.id)}
              >
                <strong>{module.nombre}</strong>
                <span>{hostLabel(module.baseUrl)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-column">
          {selected ? (
            <>
              <div className="detail-header">
                <div>
                  <h3>{selected.nombre}</h3>
                  <p className="muted">
                    Corre en <code>{hostLabel(selected.baseUrl)}</code> · salud: {healthLabel}
                  </p>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    className="button ghost danger"
                    disabled={busy}
                    onClick={() => void onRemoveModule(selected)}
                  >
                    Desincorporar
                  </button>
                ) : null}
              </div>

              <dl className="meta-list">
                <div>
                  <dt>Estado</dt>
                  <dd>{selected.estado}</dd>
                </div>
                <div>
                  <dt>Base URL</dt>
                  <dd>
                    <code>{selected.baseUrl ?? "—"}</code>
                  </dd>
                </div>
                <div>
                  <dt>Health</dt>
                  <dd>
                    <code>{selected.healthPath ?? "—"}</code> ({healthLabel})
                  </dd>
                </div>
                <div>
                  <dt>Prefijo permisos</dt>
                  <dd>
                    <code>{prefix}_*</code>
                  </dd>
                </div>
              </dl>

              {canUpdate ? (
                <form className="stack-form" onSubmit={(event) => void onSaveInfo(event)}>
                  <h3>Datos del servicio</h3>
                  <label>
                    Descripción
                    <input value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} maxLength={500} />
                  </label>
                  <label>
                    URL del servicio
                    <input value={editBaseUrl} onChange={(e) => setEditBaseUrl(e.target.value)} maxLength={500} />
                  </label>
                  <label>
                    Health path
                    <input value={editHealthPath} onChange={(e) => setEditHealthPath(e.target.value)} maxLength={200} />
                  </label>
                  <div className="inline-form">
                    <button className="button primary" type="submit" disabled={busy}>
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="button ghost"
                      disabled={busy || !editBaseUrl.trim()}
                      onClick={() =>
                        void checkHealth({
                          ...selected,
                          baseUrl: editBaseUrl.trim() || null,
                          healthPath: editHealthPath.trim() || null,
                        })
                      }
                    >
                      Probar salud
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="assign-block">
                <div className="panel-heading">
                  <h4>Menús del módulo ({moduleMenus.length})</h4>
                  {canCreateMenu && selected.nombre.toLowerCase().includes("reserva") ? (
                    <button type="button" className="button ghost" disabled={busy} onClick={() => void onCreateReservasSections()}>
                      Crear apartados Reservas
                    </button>
                  ) : null}
                </div>
                <p className="muted">
                  Crea un grupo (sin URL) y apartados hijos con URL. Al entrar al módulo podrás navegar entre ellos.
                </p>
                <ul className="chip-list">
                  {moduleMenus.map((menu) => (
                    <li key={menu.id}>
                      <span>
                        {menu.nombre} <code>{menu.url ?? "grupo"}</code>
                        {menu.parentId ? <span className="muted"> · hijo</span> : null}
                      </span>
                      {canDeleteMenu ? (
                        <button type="button" className="button ghost danger" disabled={busy} onClick={() => void onRemoveMenu(menu)}>
                          Quitar
                        </button>
                      ) : null}
                    </li>
                  ))}
                  {moduleMenus.length === 0 ? <li className="muted">Aún no hay menús para este módulo.</li> : null}
                </ul>

                {canCreateMenu ? (
                  <form className="stack-form" onSubmit={(event) => void onCreateMenu(event)}>
                    <h3>Nuevo menú / apartado</h3>
                    <div className="form-grid">
                      <label>
                        Nombre
                        <input value={menuNombre} onChange={(e) => setMenuNombre(e.target.value)} required maxLength={255} />
                      </label>
                      <label>
                        URL SPA
                        <input
                          value={menuUrl}
                          onChange={(e) => setMenuUrl(e.target.value)}
                          maxLength={500}
                          disabled={menuAsGroup}
                          placeholder="/reservas/hoteles"
                        />
                      </label>
                      <label>
                        Orden
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          value={menuOrden}
                          onChange={(e) => setMenuOrden(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Menú padre (opcional)
                        <select value={menuParentId} onChange={(e) => setMenuParentId(e.target.value)}>
                          <option value="">Ninguno (raíz)</option>
                          {moduleMenus.map((menu) => (
                            <option key={menu.id} value={menu.id}>
                              {menu.nombre}
                              {menu.url ? ` (${menu.url})` : " (grupo)"}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={menuAsGroup}
                        onChange={(e) => setMenuAsGroup(e.target.checked)}
                      />
                      Crear como grupo (sin URL; solo agrupa apartados)
                    </label>
                    <button className="button primary" type="submit" disabled={busy || !menuNombre.trim()}>
                      Crear y asignar al rol
                    </button>
                  </form>
                ) : null}
              </div>

              <div className="assign-block">
                <div className="panel-heading">
                  <h4>Permisos del módulo</h4>
                  {canAssignPermission ? (
                    <button type="button" className="button ghost" disabled={busy} onClick={() => void ensureModulePermissions()}>
                      Crear {prefix}_READ / _CREATE
                    </button>
                  ) : null}
                </div>
                <label>
                  Rol a editar
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="check-grid">
                  {modulePermissions.map((permission) => {
                    const active = roleDetailPermIds.has(permission.id);
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        className={`check-chip ${active ? "on" : ""}`}
                        disabled={busy || !canAssignPermission}
                        onClick={() => void onTogglePermission(permission)}
                      >
                        {permission.codigo}
                      </button>
                    );
                  })}
                  {modulePermissions.length === 0 ? (
                    <p className="muted">No hay permisos con prefijo {prefix}_*. Créalos con el botón de arriba.</p>
                  ) : null}
                </div>
                <p className="muted">Tras cambiar permisos, vuelve a seleccionar el rol en el login para refrescar el JWT.</p>
              </div>
            </>
          ) : (
            <p className="muted">Selecciona o crea un módulo para ver su detalle.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function MenusAdminPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<SafeMenu[]>([]);
  const [modules, setModules] = useState<SafeModule[]>([]);
  const [roles, setRoles] = useState<SafeRole[]>([]);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [orden, setOrden] = useState(10);
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission("MENUS_CREATE");
  const canDelete = hasPermission("MENUS_DELETE");
  const canAssignMenu = hasPermission("ROLES_ASSIGN_MENU");

  async function load() {
    const [menusRes, modulesRes] = await Promise.all([menusApi.list(), modulesApi.list()]);
    setMenus(menusRes.data);
    setModules(modulesRes.data);
    if (!moduleId && modulesRes.data[0]) setModuleId(modulesRes.data[0].id);
    if (canAssignMenu) {
      const rolesRes = await rolesApi.list();
      setRoles(rolesRes.data);
      if (!roleId && rolesRes.data[0]) setRoleId(rolesRes.data[0].id);
    }
  }

  useEffect(() => {
    if (!hasPermission("MENUS_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }
    load().catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 403) {
        navigate("/forbidden", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Error al cargar menús");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, navigate]);

  async function onRemove(menu: SafeMenu) {
    if (!canDelete) return;
    if (!window.confirm(`¿Desactivar el menú “${menu.nombre}”?`)) return;
    setBusy(true);
    try {
      await menusApi.remove(menu.id);
      setOk(`Menú “${menu.nombre}” desactivado`);
      await load();
      window.dispatchEvent(new Event("master:menu-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar el menú");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!canCreate || !moduleId) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const created = await menusApi.create({
        nombre: nombre.trim(),
        url: url.trim() || null,
        moduleId,
        orden: Number.isFinite(orden) ? orden : 10,
      });
      if (canAssignMenu && roleId) {
        await rolesApi.assignMenu(roleId, created.id);
      }
      setNombre("");
      setUrl("");
      setOrden(10);
      setOk(`Menú “${created.nombre}” creado`);
      await load();
      window.dispatchEvent(new Event("master:menu-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el menú");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-wide">
      <h2>Menús</h2>
      <p className="muted">Catálogo global. Para un módulo concreto usa el panel de Módulos.</p>
      {error ? <p className="error-text">{error}</p> : null}
      {ok ? <p className="success-text">{ok}</p> : null}

      {canCreate ? (
        <form className="stack-form user-create" onSubmit={(event) => void onCreate(event)}>
          <h3>Nuevo menú</h3>
          <div className="form-grid">
            <label>
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={255} />
            </label>
            <label>
              URL
              <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="/reservas" />
            </label>
            <label>
              Módulo
              <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} required>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Orden
              <input type="number" min={0} max={10000} value={orden} onChange={(e) => setOrden(Number(e.target.value))} />
            </label>
          </div>
          {canAssignMenu && roles.length > 0 ? (
            <label>
              Asignar al rol
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="button primary" type="submit" disabled={busy || !nombre.trim() || !moduleId}>
            Crear menú
          </button>
        </form>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>URL</th>
              <th>Orden</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {menus.map((menu) => (
              <tr key={menu.id}>
                <td>{menu.nombre}</td>
                <td>{menu.url ?? "—"}</td>
                <td>{menu.orden}</td>
                <td>{menu.estado}</td>
                <td>
                  {canDelete ? (
                    <button type="button" className="button ghost danger" disabled={busy} onClick={() => void onRemove(menu)}>
                      Quitar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
