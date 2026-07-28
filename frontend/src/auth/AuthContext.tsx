import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../api/endpoints";
import { tokenStorage } from "./tokenStorage";
import type { RoleOption } from "../types";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  tempToken: string | null;
  roles: RoleOption[];
  role: RoleOption | null;
  permissions: string[];
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  needsRoleSelection: boolean;
  login: (email: string, password: string) => Promise<void>;
  selectRole: (roleId: string) => Promise<void>;
  switchRole: (roleId: string) => Promise<void>;
  refreshAvailableRoles: () => Promise<void>;
  cancelRoleSelection: () => void;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readState(): AuthState {
  return {
    accessToken: tokenStorage.getAccessToken(),
    refreshToken: tokenStorage.getRefreshToken(),
    tempToken: tokenStorage.getTempToken(),
    roles: tokenStorage.getRoles(),
    role: tokenStorage.getRole(),
    permissions: tokenStorage.getPermissions(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => readState());

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    tokenStorage.setLogin(data);
    setState(readState());
  }, []);

  const selectRole = useCallback(async (roleId: string) => {
    const tempToken = tokenStorage.getTempToken();
    if (!tempToken) {
      throw new Error("No hay TempToken disponible");
    }
    const availableRoles = tokenStorage.getRoles();
    const data = await authApi.selectRole(tempToken, roleId);
    tokenStorage.setSession({
      ...data,
      roles: data.roles && data.roles.length > 0 ? data.roles : availableRoles,
    });
    setState(readState());
  }, []);

  const switchRole = useCallback(async (roleId: string) => {
    const refreshToken = tokenStorage.getRefreshToken();
    const data = await authApi.switchRole(roleId, refreshToken);
    const availableRoles = data.roles && data.roles.length > 0 ? data.roles : tokenStorage.getRoles();
    tokenStorage.setSession({
      ...data,
      roles: availableRoles,
    });
    setState(readState());
  }, []);

  const refreshAvailableRoles = useCallback(async () => {
    const data = await authApi.myRoles();
    tokenStorage.setAvailableRoles(data.roles);
    setState(readState());
  }, []);

  const cancelRoleSelection = useCallback(() => {
    tokenStorage.clear();
    setState(readState());
  }, []);

  const logout = useCallback(async () => {
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      await authApi.logout(accessToken, refreshToken);
    } catch {
      // El logout local siempre limpia, aunque el backend falle.
    }
    tokenStorage.clear();
    setState(readState());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.accessToken && state.role),
      needsRoleSelection: Boolean(state.tempToken && !state.accessToken),
      login,
      selectRole,
      switchRole,
      refreshAvailableRoles,
      cancelRoleSelection,
      logout,
      hasPermission: (code: string) => state.permissions.includes(code),
    }),
    [state, login, selectRole, switchRole, refreshAvailableRoles, cancelRoleSelection, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
