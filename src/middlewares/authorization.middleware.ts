import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../common/http-error.js";
import type { AuthRequest } from "./auth.middleware.js";

export function requirePermissions(...requiredPermissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError(401, "UNAUTHORIZED", "Autenticación requerida");
    }

    const userPermissions = req.user.permissions;
    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissions.includes(permission),
    );

    if (missingPermissions.length > 0) {
      throw new HttpError(403, "INSUFFICIENT_PERMISSIONS", "Permisos insuficientes");
    }

    next();
  };
}

export function requireAnyPermission(...requiredPermissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError(401, "UNAUTHORIZED", "Autenticación requerida");
    }

    const userPermissions = req.user.permissions;
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new HttpError(403, "INSUFFICIENT_PERMISSIONS", "Permisos insuficientes");
    }

    next();
  };
}
