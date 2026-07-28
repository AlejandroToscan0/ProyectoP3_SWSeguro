import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ventasApi, type Sale } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../types";

export function VentasPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [producto, setProducto] = useState("Producto demo");
  const [monto, setMonto] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSales() {
    setLoading(true);
    setError(null);
    try {
      const result = await ventasApi.list();
      setSales(result.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        navigate("/forbidden", { replace: true });
        return;
      }
        if (err instanceof ApiError && err.status === 401) {
          navigate(err.code === "TOKEN_EXPIRED" ? "/token-expired" : "/session-expired", { replace: true });
          return;
        }
      setError(err instanceof Error ? err.message : "No se pudo cargar ventas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasPermission("VENTAS_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }
    void loadSales();
  }, [hasPermission, navigate]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!hasPermission("VENTAS_CREATE")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    try {
      await ventasApi.create({
        producto,
        monto: Number(monto),
      });
      await loadSales();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        navigate("/forbidden", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo crear la venta");
    }
  }

  return (
    <section className="panel">
      <h2>Ventas</h2>
      <p className="muted">
        Esta pantalla habla con el microservicio hijo. El hijo valida el token contra el Master (Zero Trust).
      </p>

      <form className="form" onSubmit={onCreate}>
        <label>
          Producto
          <input value={producto} onChange={(e) => setProducto(e.target.value)} required />
        </label>
        <label>
          Monto
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
        </label>
        <button className="button primary" type="submit" disabled={!hasPermission("VENTAS_CREATE")}>
          Registrar venta
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p className="muted">Cargando…</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Monto</th>
              <th>Creado por</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.producto}</td>
                <td>{sale.monto}</td>
                <td>
                  <code>{sale.creadoPor.slice(0, 8)}…</code>
                </td>
                <td>{new Date(sale.fechaCreacion).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
