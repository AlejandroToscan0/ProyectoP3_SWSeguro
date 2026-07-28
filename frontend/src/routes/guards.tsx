import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, needsRoleSelection } = useAuth();
  const location = useLocation();

  if (needsRoleSelection) {
    return <Navigate to="/select-role" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, needsRoleSelection } = useAuth();

  if (needsRoleSelection) {
    return <Navigate to="/select-role" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}

export function RoleSelectionRoute() {
  const { needsRoleSelection, isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  if (!needsRoleSelection) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
