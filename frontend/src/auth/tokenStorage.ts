import type { AuthSession, LoginResponse, RoleOption } from "../types";

const KEYS = {
  accessToken: "mg.accessToken",
  refreshToken: "mg.refreshToken",
  role: "mg.role",
  permissions: "mg.permissions",
  tempToken: "mg.tempToken",
  roles: "mg.roles",
} as const;

export const tokenStorage = {
  getAccessToken(): string | null {
    return sessionStorage.getItem(KEYS.accessToken);
  },

  getRefreshToken(): string | null {
    return sessionStorage.getItem(KEYS.refreshToken);
  },

  getTempToken(): string | null {
    return sessionStorage.getItem(KEYS.tempToken);
  },

  getRole(): RoleOption | null {
    const raw = sessionStorage.getItem(KEYS.role);
    return raw ? (JSON.parse(raw) as RoleOption) : null;
  },

  getPermissions(): string[] {
    const raw = sessionStorage.getItem(KEYS.permissions);
    return raw ? (JSON.parse(raw) as string[]) : [];
  },

  getRoles(): RoleOption[] {
    const raw = sessionStorage.getItem(KEYS.roles);
    return raw ? (JSON.parse(raw) as RoleOption[]) : [];
  },

  setLogin(data: LoginResponse): void {
    sessionStorage.setItem(KEYS.tempToken, data.tempToken);
    sessionStorage.setItem(KEYS.roles, JSON.stringify(data.roles));
    sessionStorage.removeItem(KEYS.accessToken);
    sessionStorage.removeItem(KEYS.refreshToken);
    sessionStorage.removeItem(KEYS.role);
    sessionStorage.removeItem(KEYS.permissions);
  },

  setSession(data: AuthSession): void {
    sessionStorage.setItem(KEYS.accessToken, data.accessToken);
    sessionStorage.setItem(KEYS.refreshToken, data.refreshToken);
    sessionStorage.setItem(KEYS.role, JSON.stringify(data.role));
    sessionStorage.setItem(KEYS.permissions, JSON.stringify(data.permissions));
    sessionStorage.removeItem(KEYS.tempToken);
    sessionStorage.removeItem(KEYS.roles);
  },

  clear(): void {
    Object.values(KEYS).forEach((key) => sessionStorage.removeItem(key));
  },
};
