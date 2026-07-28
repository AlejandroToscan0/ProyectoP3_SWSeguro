import type { AuthSession, LoginResponse, RoleOption } from "../types";

const KEYS = {
  accessToken: "mg.accessToken",
  refreshToken: "mg.refreshToken",
  role: "mg.role",
  permissions: "mg.permissions",
  tempToken: "mg.tempToken",
  roles: "mg.roles",
} as const;

// encodeURIComponent/decodeURIComponent sanitize values crossing the
// browser-storage boundary so tainted API data is never written verbatim.
function setItem(key: string, value: string): void {
  sessionStorage.setItem(key, encodeURIComponent(value));
}

function getItem(key: string): string | null {
  const raw = sessionStorage.getItem(key);
  return raw !== null ? decodeURIComponent(raw) : null;
}

function setJSON(key: string, value: unknown): void {
  setItem(key, JSON.stringify(value));
}

function getJSON<T>(key: string): T | null {
  const raw = getItem(key);
  return raw !== null ? (JSON.parse(raw) as T) : null;
}

export const tokenStorage = {
  getAccessToken(): string | null {
    return getItem(KEYS.accessToken);
  },

  getRefreshToken(): string | null {
    return getItem(KEYS.refreshToken);
  },

  getTempToken(): string | null {
    return getItem(KEYS.tempToken);
  },

  getRole(): RoleOption | null {
    return getJSON<RoleOption>(KEYS.role);
  },

  getPermissions(): string[] {
    return getJSON<string[]>(KEYS.permissions) ?? [];
  },

  getRoles(): RoleOption[] {
    return getJSON<RoleOption[]>(KEYS.roles) ?? [];
  },

  setLogin(data: LoginResponse): void {
    setItem(KEYS.tempToken, data.tempToken);
    setJSON(KEYS.roles, data.roles);
    sessionStorage.removeItem(KEYS.accessToken);
    sessionStorage.removeItem(KEYS.refreshToken);
    sessionStorage.removeItem(KEYS.role);
    sessionStorage.removeItem(KEYS.permissions);
  },

  setSession(data: AuthSession): void {
    setItem(KEYS.accessToken, data.accessToken);
    setItem(KEYS.refreshToken, data.refreshToken);
    setJSON(KEYS.role, data.role);
    setJSON(KEYS.permissions, data.permissions);
    sessionStorage.removeItem(KEYS.tempToken);
    sessionStorage.removeItem(KEYS.roles);
  },

  clear(): void {
    Object.values(KEYS).forEach((key) => sessionStorage.removeItem(key));
  },
};
