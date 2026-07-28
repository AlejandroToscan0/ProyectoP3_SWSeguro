import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../types";

export function SelectRolePage() {
  const { roles, selectRole } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function confirmRole() {
    if (!selected) {
      setError("Seleccione un rol para continuar");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await selectRole(selected);
      navigate("/app", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo seleccionar el rol");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-panel">
        <p className="brand">Master Gateway</p>
        <h1>Seleccionar espacio de trabajo</h1>
        <p className="muted">
          Debe elegir un rol activo. El token definitivo solo incluirá los permisos de ese rol.
        </p>

        <div className="role-grid">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={selected === role.id ? "role-card selected" : "role-card"}
              onClick={() => setSelected(role.id)}
            >
              <strong>{role.nombre}</strong>
              <span className="muted">Contexto de seguridad aislado</span>
            </button>
          ))}
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <button className="button primary" type="button" onClick={confirmRole} disabled={loading || !selected}>
          {loading ? "Generando sesión…" : "Entrar con este rol"}
        </button>
      </section>
    </div>
  );
}
