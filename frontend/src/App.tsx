import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { GuestRoute, ProtectedRoute, RoleSelectionRoute } from "./routes/guards";
import { LoginPage } from "./pages/LoginPage";
import { SelectRolePage } from "./pages/SelectRolePage";
import { HomePage } from "./pages/HomePage";
import { UsersPage } from "./pages/UsersPage";
import { RolesPage } from "./pages/RolesPage";
import { ModulesPage, MenusAdminPage } from "./pages/ModulesMenusPages";
import { VentasPage } from "./pages/VentasPage";
import { ReservasPage } from "./pages/ReservasPage";
import { DynamicModulePage } from "./pages/DynamicModulePage";
import { ForbiddenPage, SessionExpiredPage, TokenExpiredPage } from "./pages/StatusPages";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<RoleSelectionRoute />}>
            <Route path="/select-role" element={<SelectRolePage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="usuarios" element={<UsersPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="modulos" element={<ModulesPage />} />
              <Route path="menus" element={<MenusAdminPage />} />
              <Route path="ventas" element={<VentasPage />} />
              <Route path="reservas/*" element={<ReservasPage />} />
              <Route path="*" element={<DynamicModulePage />} />
            </Route>
          </Route>

          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="/session-expired" element={<SessionExpiredPage />} />
          <Route path="/token-expired" element={<TokenExpiredPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
