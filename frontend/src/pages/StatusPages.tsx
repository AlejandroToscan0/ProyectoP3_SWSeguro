import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function ForbiddenPage() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="status-page">
      <p className="brand">Master Gateway</p>
      <h1>Acceso denegado</h1>
      <p className="muted">Su rol activo no tiene permisos para este recurso.</p>
      <div className="auth-actions">
        {isAuthenticated ? (
          <Link className="button primary" to="/app">
            Volver al inicio
          </Link>
        ) : (
          <Link className="button primary" to="/login">
            Ir al login
          </Link>
        )}
        {isAuthenticated ? (
          <button className="button ghost auth-back" type="button" onClick={() => void onLogout()}>
            Cerrar sesión / otro usuario
          </button>
        ) : null}
      </div>
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
