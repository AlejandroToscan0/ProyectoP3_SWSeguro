import { ApiError } from "../types";
import { tokenStorage } from "../auth/tokenStorage";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${API_BASE}/api/auth/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    tokenStorage.clear();
    return false;
  }

  const data = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
    role: { id: string; nombre: string };
    permissions: string[];
  };

  tokenStorage.setSession(data);
  return true;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.auth !== false) {
    const accessToken = tokenStorage.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    // Evita 304 vacío vía proxy (rompe tipados que esperan arrays/objetos).
    cache: "no-store",
  });

  if (response.status === 401 && options.auth !== false && !options.skipRefresh) {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) {
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    throw new ApiError(401, "TOKEN_EXPIRED", "No fue posible renovar el access token");
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    throw new ApiError(
      response.status,
      typeof errorPayload.error === "string" ? errorPayload.error : "REQUEST_FAILED",
      typeof errorPayload.message === "string" ? errorPayload.message : "Error en la solicitud",
    );
  }

  return payload as T;
}
