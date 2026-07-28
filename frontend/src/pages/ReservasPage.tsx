import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ModuleWorkspace } from "../components/ModuleWorkspace";
import { getModuleNavForPath } from "../menu/treeUtils";
import type { MenuTreeNode } from "../types";

type Hotel = {
  id: number;
  name: string;
  city?: string;
  country?: string;
  _count?: { reservations: number };
};

type Guest = {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};

type Reservation = {
  id: number;
  checkIn: string;
  checkOut: string;
  status?: string;
  totalPrice?: string | number;
  hotel?: { name: string };
  guest?: { firstName: string; lastName: string };
};

type Stats = {
  totalHotels: number;
  totalGuests: number;
  totalReservations: number;
  activeReservations: number;
  totalRevenue: number;
};

type ShellContext = {
  tree: MenuTreeNode[];
};

const RESERVAS_BASE = import.meta.env.VITE_RESERVAS_URL ?? "http://localhost:3002";

type Section = "resumen" | "hoteles" | "huespedes" | "reservaciones";

function resolveSection(pathname: string): Section {
  const rel = pathname.replace(/^\/app/, "").replace(/\/+$/, "");
  if (rel.includes("/hoteles")) return "hoteles";
  if (rel.includes("/huespedes")) return "huespedes";
  if (rel.includes("/reservaciones") || rel.includes("/reservas/reservas")) return "reservaciones";
  return "resumen";
}

function statusClass(status?: string): string {
  const value = (status ?? "").toUpperCase();
  if (value.includes("CANCEL")) return "status-badge danger";
  if (value.includes("CHECK")) return "status-badge accent";
  if (value.includes("CONFIRM")) return "status-badge ok";
  return "status-badge";
}

export function ReservasPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tree = [] } = useOutletContext<ShellContext>() ?? { tree: [] };

  const section = resolveSection(location.pathname);
  const moduleNav = useMemo(() => getModuleNavForPath(tree, location.pathname), [tree, location.pathname]);

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission("RESERVAS_READ")) {
      navigate("/forbidden", { replace: true });
      return;
    }

    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (section === "resumen") {
          const [hotelsRes, statsRes] = await Promise.all([
            fetch(`${RESERVAS_BASE}/api/hotels`),
            fetch(`${RESERVAS_BASE}/api/stats`),
          ]);
          if (!hotelsRes.ok || !statsRes.ok) {
            throw new Error("No se pudo contactar el microservicio de reservas (¿está en :3002?)");
          }
          const hotelsData = (await hotelsRes.json()) as Hotel[];
          const statsData = (await statsRes.json()) as Stats;
          if (active) {
            setHotels(hotelsData);
            setStats(statsData);
          }
        } else if (section === "hoteles") {
          const hotelsRes = await fetch(`${RESERVAS_BASE}/api/hotels`);
          if (!hotelsRes.ok) throw new Error("No se pudieron cargar los hoteles");
          if (active) setHotels((await hotelsRes.json()) as Hotel[]);
        } else if (section === "huespedes") {
          const guestsRes = await fetch(`${RESERVAS_BASE}/api/guests`);
          if (!guestsRes.ok) throw new Error("No se pudieron cargar los huéspedes");
          if (active) setGuests((await guestsRes.json()) as Guest[]);
        } else {
          const reservationsRes = await fetch(`${RESERVAS_BASE}/api/reservations`);
          if (!reservationsRes.ok) throw new Error("No se pudieron cargar las reservaciones");
          if (active) setReservations((await reservationsRes.json()) as Reservation[]);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error cargando reservas");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [hasPermission, navigate, section]);

  const titles: Record<Section, string> = {
    resumen: "Resumen",
    hoteles: "Hoteles",
    huespedes: "Huéspedes",
    reservaciones: "Reservaciones",
  };

  const leads: Record<Section, string> = {
    resumen: "Vista general del inventario hotelero y la ocupación.",
    hoteles: "Catálogo de hoteles del microservicio hijo.",
    huespedes: "Huéspedes registrados en el sistema de reservas.",
    reservaciones: "Reservas activas e históricas.",
  };

  return (
    <ModuleWorkspace
      eyebrow="Reservas"
      title={titles[section]}
      description={leads[section]}
      items={moduleNav}
      footer={
        <p className="muted">
          Servicio hijo · <code>{RESERVAS_BASE}</code>
        </p>
      }
    >
      {loading ? (
        <div className="empty-state">
          <p className="muted">Cargando apartado…</p>
        </div>
      ) : null}

      {error ? (
        <div className="empty-state empty-state-error">
          <p className="error-text">{error}</p>
        </div>
      ) : null}

      {!loading && !error && section === "resumen" ? (
        <div className="module-section fade-in">
          {stats ? (
            <div className="stats stats-4">
              <article>
                <span>Hoteles</span>
                <strong>{stats.totalHotels}</strong>
              </article>
              <article>
                <span>Huéspedes</span>
                <strong>{stats.totalGuests}</strong>
              </article>
              <article>
                <span>Reservas</span>
                <strong>{stats.totalReservations}</strong>
              </article>
              <article>
                <span>Activas</span>
                <strong>{stats.activeReservations}</strong>
              </article>
            </div>
          ) : null}

          <div className="section-block">
            <div className="section-block-head">
              <h3>Hoteles recientes</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hotel</th>
                    <th>Ciudad</th>
                    <th>Reservas</th>
                  </tr>
                </thead>
                <tbody>
                  {hotels.slice(0, 8).map((hotel) => (
                    <tr key={hotel.id}>
                      <td>
                        <strong>{hotel.name}</strong>
                      </td>
                      <td>{hotel.city ?? "—"}</td>
                      <td>{hotel._count?.reservations ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error && section === "hoteles" ? (
        <div className="module-section fade-in">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Ciudad</th>
                  <th>País</th>
                  <th>Reservas</th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((hotel) => (
                  <tr key={hotel.id}>
                    <td>
                      <strong>{hotel.name}</strong>
                    </td>
                    <td>{hotel.city ?? "—"}</td>
                    <td>{hotel.country ?? "—"}</td>
                    <td>{hotel._count?.reservations ?? 0}</td>
                  </tr>
                ))}
                {hotels.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Sin hoteles registrados
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && !error && section === "huespedes" ? (
        <div className="module-section fade-in">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td>
                      <strong>
                        {guest.firstName} {guest.lastName}
                      </strong>
                    </td>
                    <td>{guest.email ?? "—"}</td>
                    <td>{guest.phone ?? "—"}</td>
                  </tr>
                ))}
                {guests.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      Sin huéspedes registrados
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && !error && section === "reservaciones" ? (
        <div className="module-section fade-in">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Huésped</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Estado</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.hotel?.name ?? "—"}</strong>
                    </td>
                    <td>{item.guest ? `${item.guest.firstName} ${item.guest.lastName}` : "—"}</td>
                    <td>{item.checkIn?.slice(0, 10) ?? "—"}</td>
                    <td>{item.checkOut?.slice(0, 10) ?? "—"}</td>
                    <td>
                      <span className={statusClass(item.status)}>{item.status ?? "—"}</span>
                    </td>
                    <td>{item.totalPrice ?? "—"}</td>
                  </tr>
                ))}
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Sin reservaciones
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </ModuleWorkspace>
  );
}
