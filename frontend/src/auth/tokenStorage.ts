import type { AuthSession, LoginResponse, RoleOption } from "../types";

const KEYS = {
  accessToken: "mg.accessToken",
  refreshToken: "mg.refreshToken",
  role: "mg.role",
  permissions: "mg.permissions",
  tempToken: "mg.tempToken",
  roles: "mg.roles",
} as const;

function sanitizeString(value: string): string {
  return typeof value === "string" ? value.replace(/[<>"'`]/g, "") : "";
}

function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeString(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeDeep(val);
    }
    return sanitized as T;
  }
  return value;
}

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
    sessionStorage.setItem(KEYS.tempToken, sanitizeString(data.tempToken));
    sessionStorage.setItem(KEYS.roles, JSON.stringify(sanitizeDeep(data.roles)));
    sessionStorage.removeItem(KEYS.accessToken);
    sessionStorage.removeItem(KEYS.refreshToken);
    sessionStorage.removeItem(KEYS.role);
    sessionStorage.removeItem(KEYS.permissions);
  },

  setSession(data: AuthSession): void {
    sessionStorage.setItem(KEYS.accessToken, sanitizeString(data.accessToken));
    sessionStorage.setItem(KEYS.refreshToken, sanitizeString(data.refreshToken));
    sessionStorage.setItem(KEYS.role, JSON.stringify(sanitizeDeep(data.role)));
    sessionStorage.setItem(KEYS.permissions, JSON.stringify(sanitizeDeep(data.permissions)));
    sessionStorage.removeItem(KEYS.tempToken);
    sessionStorage.removeItem(KEYS.roles);
  },

  clear(): void {
    Object.values(KEYS).forEach((key) => sessionStorage.removeItem(key));
  },
};
