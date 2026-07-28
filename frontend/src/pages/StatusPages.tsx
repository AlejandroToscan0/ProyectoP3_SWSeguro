import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <div className="status-page">
      <p className="brand">Master Gateway</p>
      <h1>Acceso denegado</h1>
      <p className="muted">Su rol activo no tiene permisos para este recurso.</p>
      <Link className="button primary" to="/app">
        Volver al inicio
      </Link>
    </div>
  );
}

export function SessionExpiredPage() {
  return (
    <div className="status-page">
      <p className="brand">Master Gateway</p>
      <h1>Sesión expirada</h1>
      <p className="muted">El token ya no es válido. Inicie sesión nuevamente.</p>
      <Link className="button primary" to="/login">
        Ir al login
      </Link>
    </div>
  );
}

export function TokenExpiredPage() {
  return (
    <div className="status-page">
      <p className="brand">Master Gateway</p>
      <h1>Token expirado</h1>
      <p className="muted">No fue posible renovar el access token. Debe autenticarse otra vez.</p>
      <Link className="button primary" to="/login">
        Ir al login
      </Link>
    </div>
  );
}
