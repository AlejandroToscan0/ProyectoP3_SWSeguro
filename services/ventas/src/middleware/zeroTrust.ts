import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../common/http-error.js";

export type AuthenticatedRequest = Request & {
  auth?: {
    userId: string;
    roleId: string;
    roleName: string;
    permissions: string[];
  };
};

type ValidateTokenResponse = {
  active: boolean;
  userId: string;
  roleId: string;
  roleName: string;
  permissions: string[];
};

const MASTER_RETRY_ATTEMPTS = 4;
const MASTER_RETRY_BASE_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientMasterFailure(status: number | null, error: unknown): boolean {
  if (status !== null && status >= 500) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("fetch failed") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("enotfound") ||
      message.includes("network")
    );
  }
  return false;
}

async function validateWithMaster(
  token: string,
  required: string[],
): Promise<{ status: number; payload: Partial<ValidateTokenResponse> & { error?: string; message?: string } }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MASTER_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${env.MASTER_BASE_URL}/api/internals/validate-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": env.INTERNAL_API_KEY,
        },
        body: JSON.stringify({
          token,
          requiredPermissions: required,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<ValidateTokenResponse> & {
        error?: string;
        message?: string;
      };

      // 4xx de negocio no se reintentan (token inválido / permisos).
      if (response.ok || response.status < 500) {
        return { status: response.status, payload };
      }

      lastError = new Error(`Master respondió ${response.status}`);
      if (attempt < MASTER_RETRY_ATTEMPTS && isTransientMasterFailure(response.status, lastError)) {
        await sleep(MASTER_RETRY_BASE_MS * attempt);
        continue;
      }

      return { status: response.status, payload };
    } catch (error) {
      lastError = error;
      if (attempt < MASTER_RETRY_ATTEMPTS && isTransientMasterFailure(null, error)) {
        // PaaS free tier: el Master puede estar dormido; reintentar con backoff.
        await sleep(MASTER_RETRY_BASE_MS * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No se pudo contactar al Master Gateway");
}

export function requirePermissions(...required: string[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        throw new HttpError(401, "MISSING_TOKEN", "Token de autenticación requerido");
      }

      const token = authHeader.slice(7);
      const { status, payload } = await validateWithMaster(token, required);

      if (status === 403) {
        throw new HttpError(403, "INSUFFICIENT_PERMISSIONS", payload.message ?? "Permisos insuficientes");
      }

      if (status >= 500) {
        throw new HttpError(
          503,
          "MASTER_UNAVAILABLE",
          "Master Gateway no disponible (posible cold start en PaaS). Reintente en unos segundos.",
        );
      }

      if (status !== 200 || !payload.active) {
        throw new HttpError(
          401,
          payload.error ?? "INVALID_ACCESS_TOKEN",
          payload.message ?? "Token inválido o expirado",
        );
      }

      if (
        typeof payload.userId !== "string" ||
        typeof payload.roleId !== "string" ||
        typeof payload.roleName !== "string" ||
        !Array.isArray(payload.permissions)
      ) {
        throw new HttpError(
          503,
          "MASTER_INVALID_RESPONSE",
          "Respuesta inválida del Master Gateway al validar el token",
        );
      }

      req.auth = {
        userId: payload.userId,
        roleId: payload.roleId,
        roleName: payload.roleName,
        permissions: payload.permissions.filter((p): p is string => typeof p === "string"),
      };

      next();
    } catch (error) {
      if (error instanceof HttpError) {
        next(error);
        return;
      }
      next(
        new HttpError(
          503,
          "MASTER_UNAVAILABLE",
          "No se pudo validar el token con Master Gateway. Reintente en unos segundos.",
        ),
      );
    }
  };
}
