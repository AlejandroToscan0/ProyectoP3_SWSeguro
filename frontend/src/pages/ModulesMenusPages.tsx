import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { menusApi, modulesApi, rolesApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { ApiError, type SafeMenu, type SafeModule, type SafeRole } from "../types";

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

export function ModulesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<SafeModule[]>([]);
  const [roles, setRoles] = useState<SafeRole[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [withMenu, setWithMenu] = useState(true);
  const [menuNombre, setMenuNombre] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuOrden, setMenuOrden] = useState(10);
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = hasPermission("MODULES_CREATE");
  const canCreateMenu = hasPermission("MENUS_CREATE");
  const canAssignModule = hasPermission("ROLES_ASSIGN_MODULE");
  const canAssignMenu = hasPermission("ROLES_ASSIGN_MENU");

  const suggestedUrl = useMemo(() => slugifyPath(nombre), [nombre]);

  async function load() {
    const modulesRes = await modulesApi.list();
    setModules(modulesRes.data);

    if (canAssignModule || canAssignMenu) {
      const rolesRes = await rolesApi.list();
      setRoles(rolesRes.data);
      if (!roleId && rolesRes.data[0]) {
        setRoleId(rolesRes.data[0].id);
      }
    }
  }

  useEffect(() => {
    if (!hasPermission("MODULES_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    load().catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 403) {
        navigate("/forbidden", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Error al cargar módulos");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, navigate]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;

    const cleanNombre = nombre.trim();
    if (!cleanNombre) return;

    setBusy(true);
    setError(null);
    setOk(null);

    try {
      const created = await modulesApi.create({
        nombre: cleanNombre,
        descripcion: descripcion.trim() || undefined,
      });

      let createdMenu: SafeMenu | null = null;
      const shouldCreateMenu = withMenu && canCreateMenu;
      if (shouldCreateMenu) {
        createdMenu = await menusApi.create({
          nombre: (menuNombre.trim() || cleanNombre).slice(0, 255),
          url: (menuUrl.trim() || suggestedUrl).slice(0, 500),
          moduleId: created.id,
          orden: Number.isFinite(menuOrden) ? menuOrden : 10,
        });
      }

      const assignBits: string[] = [];
      if (roleId && canAssignModule) {
        await rolesApi.assignModule(roleId, created.id);
        assignBits.push("módulo");
      }
      if (roleId && canAssignMenu && createdMenu) {
        await rolesApi.assignMenu(roleId, createdMenu.id);
        assignBits.push("menú");
      }

      setNombre("");
      setDescripcion("");
      setMenuNombre("");
      setMenuUrl("");
      setMenuOrden(10);
      setWithMenu(true);

      const roleLabel = roles.find((role) => role.id === roleId)?.nombre;
      setOk(
        [
          `Módulo “${created.nombre}” creado`,
          createdMenu ? `menú “${createdMenu.nombre}” (${createdMenu.url})` : null,
          assignBits.length && roleLabel
            ? `asignado a ${roleLabel}: ${assignBits.join(" + ")}`
            : null,
        ]
          .filter(Boolean)
          .join(". ") + ".",
      );
      await load();
      if (assignBits.includes("menú")) {
        window.dispatchEvent(new Event("master:menu-refresh"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el módulo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-wide">
      <h2>Módulos</h2>
      <p className="muted">
        Alta de módulos en el Master. Opcionalmente crea el menú y asígnalo a un rol para que aparezca en la
        navegación dinámica.
      </p>
      {error ? <p className="error-text">{error}</p> : null}
      {ok ? <p className="success-text">{ok}</p> : null}

      {canCreate ? (
        <form className="stack-form user-create" onSubmit={(event) => void onCreate(event)}>
          <h3>Nuevo módulo</h3>
          <div className="form-grid">
            <label>
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={100}
                placeholder="Inventario"
              />
            </label>
            <label>
              Descripción
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={500}
                placeholder="Gestión de stock"
              />
            </label>
          </div>

          {canCreateMenu ? (
            <label className="check-inline">
              <input
                type="checkbox"
                checked={withMenu}
                onChange={(e) => setWithMenu(e.target.checked)}
              />
              Crear también entrada de menú (ruta SPA)
            </label>
          ) : null}

          {canCreateMenu && withMenu ? (
            <div className="form-grid">
              <label>
                Nombre del menú
                <input
                  value={menuNombre}
                  onChange={(e) => setMenuNombre(e.target.value)}
                  maxLength={255}
                  placeholder={nombre.trim() || "Inventario"}
                />
              </label>
              <label>
                URL
                <input
                  value={menuUrl}
                  onChange={(e) => setMenuUrl(e.target.value)}
                  maxLength={500}
                  placeholder={suggestedUrl}
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
            </div>
          ) : null}

          {(canAssignModule || canAssignMenu) && roles.length > 0 ? (
            <label>
              Asignar al rol (opcional)
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
            {busy ? "Creando…" : "Crear módulo"}
          </button>
        </form>
      ) : (
        <p className="muted">Tu rol no tiene permiso MODULES_CREATE.</p>
      )}

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
  const canAssignMenu = hasPermission("ROLES_ASSIGN_MENU");

  async function load() {
    const [menusRes, modulesRes] = await Promise.all([menusApi.list(), modulesApi.list()]);
    setMenus(menusRes.data);
    setModules(modulesRes.data);
    if (!moduleId && modulesRes.data[0]) {
      setModuleId(modulesRes.data[0].id);
    }
    if (canAssignMenu) {
      const rolesRes = await rolesApi.list();
      setRoles(rolesRes.data);
      if (!roleId && rolesRes.data[0]) {
        setRoleId(rolesRes.data[0].id);
      }
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
      setOk(
        canAssignMenu && roleId
          ? `Menú “${created.nombre}” creado y asignado al rol seleccionado`
          : `Menú “${created.nombre}” creado`,
      );
      await load();
      if (canAssignMenu && roleId) {
        window.dispatchEvent(new Event("master:menu-refresh"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el menú");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-wide">
      <h2>Menús</h2>
      <p className="muted">Estructura Adjacency List administrable desde el Master.</p>
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
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                maxLength={500}
                placeholder="/inventario"
              />
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
              <input
                type="number"
                min={0}
                max={10000}
                value={orden}
                onChange={(e) => setOrden(Number(e.target.value))}
              />
            </label>
          </div>
          {canAssignMenu && roles.length > 0 ? (
            <label>
              Asignar al rol (opcional)
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
            {busy ? "Creando…" : "Crear menú"}
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
