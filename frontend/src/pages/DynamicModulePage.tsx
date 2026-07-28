import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function DynamicModulePage() {
  const location = useLocation();
  const { role, permissions } = useAuth();

  return (
    <section className="panel">
      <h2>Módulo dinámico</h2>
      <p className="muted">
        Esta ruta se abrió desde el menú del backend. No está hardcodeada como navegación fija del frontend.
      </p>
      <dl className="meta-list">
        <div>
          <dt>Ruta actual</dt>
          <dd>
            <code>{location.pathname}</code>
          </dd>
        </div>
        <div>
          <dt>Rol activo</dt>
          <dd>{role?.nombre}</dd>
        </div>
        <div>
          <dt>Permisos recibidos</dt>
          <dd>{permissions.join(", ") || "Sin permisos"}</dd>
        </div>
      </dl>
      <p className="muted">
        La autorización definitiva permanece en el backend. El frontend solo adapta la interfaz.
      </p>
    </section>
  );
}
