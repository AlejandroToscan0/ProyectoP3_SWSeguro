import type { NextFunction, Request, Response } from "express";
import { Estado } from "@prisma/client";
import { encoder } from "../modules/auth/auth.service.js";
import { env } from "../config/env.js";
import { HttpError } from "../common/http-error.js";
import { prisma } from "../lib/prisma.js";
import { jwtVerify } from "jose";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    jti: string;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpError(401, "MISSING_TOKEN", "Token de autenticación requerido");
    }

    const token = authHeader.substring(7);

    const { payload } = await jwtVerify(token, encoder.encode(env.JWT_ACCESS_SECRET), {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    if (
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.roleId !== "string" ||
      typeof payload.roleName !== "string" ||
      !Array.isArray(payload.permissions) ||
      typeof payload.exp !== "number" ||
      typeof payload.jti !== "string"
    ) {
      throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Access token inválido");
    }

    const permissions = payload.permissions.filter((p): p is string => typeof p === "string");
    if (permissions.length !== payload.permissions.length) {
      throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Access token inválido");
    }

    const revoked = await prisma.tokenRevocation.findUnique({
      where: { jti: payload.jti },
    });
    if (revoked && revoked.estado === Estado.ACTIVO && revoked.expiracion > new Date()) {
      throw new HttpError(401, "TOKEN_REVOKED", "Access token revocado");
    }

    req.user = {
      userId: payload.sub,
      roleId: payload.roleId,
      roleName: payload.roleName,
      permissions,
      jti: payload.jti,
    };

    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
    } else {
      next(new HttpError(401, "INVALID_ACCESS_TOKEN", "Access token inválido o expirado"));
    }
  }
}
