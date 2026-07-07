import argon2 from "argon2";
import { AuditAction, Estado, Prisma, type PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";
import { HttpError } from "../../common/http-error.js";
import type { LoginInput, SelectRoleInput } from "./auth.schemas.js";

type SafeRole = {
  id: string;
  nombre: string;
};

type LoginResponse = {
  tempToken: string;
  roles: SafeRole[];
};

type SelectRoleResponse = {
  accessToken: string;
  refreshToken: string;
  role: {
    id: string;
    nombre: string;
  };
  permissions: string[];
};

const encoder = new TextEncoder();

async function signToken(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(encoder.encode(secret));
}

export class AuthService {
  constructor(private readonly db: PrismaClient) {}

  async login(
    input: LoginInput,
    meta?: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<LoginResponse> {
    const user = await this.db.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        userRoles: {
          where: { estado: Estado.ACTIVO },
          include: { role: true },
        },
      },
    });

    if (!user || user.estado !== Estado.ACTIVO) {
      await this.logAudit({
        userId: user?.id,
        action: AuditAction.LOGIN_FAILED,
        detail: "Credenciales invalidas",
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new HttpError(401, "INVALID_CREDENTIALS", "Credenciales invalidas");
    }

    const passwordOk = await argon2.verify(user.passwordHash, input.password);
    if (!passwordOk) {
      await this.logAudit({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        detail: "Credenciales invalidas",
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new HttpError(401, "INVALID_CREDENTIALS", "Credenciales invalidas");
    }

    const roles = user.userRoles
      .filter((ur) => ur.role.estado === Estado.ACTIVO)
      .map((ur) => ({
        id: ur.role.id,
        nombre: ur.role.nombre,
      }));

    if (roles.length === 0) {
      throw new HttpError(403, "ROLE_NOT_AVAILABLE", "El usuario no tiene roles activos");
    }

    const tempToken = await signToken(
      {
        sub: user.id,
        type: "temp",
      },
      env.JWT_TEMP_SECRET,
      env.TEMP_TOKEN_TTL_SECONDS,
    );

    await this.logAudit({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      detail: "Login exitoso",
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { tempToken, roles };
  }

  async selectRole(
    input: SelectRoleInput,
    meta?: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<SelectRoleResponse> {
    const tempPayload = await this.verifyTempToken(input.tempToken);
    const userId = tempPayload.sub;

    const userRole = await this.db.userRole.findFirst({
      where: {
        userId,
        roleId: input.roleId,
        estado: Estado.ACTIVO,
        role: { estado: Estado.ACTIVO },
        user: { estado: Estado.ACTIVO },
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              where: {
                estado: Estado.ACTIVO,
                permission: { estado: Estado.ACTIVO },
              },
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!userRole) {
      throw new HttpError(403, "ROLE_NOT_ALLOWED", "El rol seleccionado no es valido");
    }

    const permissions = userRole.role.rolePermissions.map((rp) => rp.permission.codigo);

    const accessToken = await signToken(
      {
        sub: userId,
        roleId: userRole.role.id,
        roleName: userRole.role.nombre,
        permissions,
        type: "access",
      },
      env.JWT_ACCESS_SECRET,
      env.ACCESS_TOKEN_TTL_SECONDS,
    );

    const rawRefreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = await argon2.hash(rawRefreshToken);

    await this.db.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        expiracion: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        creadoPor: userId,
        actualizadoPor: userId,
      },
    });

    await this.logAudit({
      userId,
      roleId: userRole.role.id,
      action: AuditAction.ROLE_SELECTED,
      detail: `Rol activo: ${userRole.role.nombre}`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      role: {
        id: userRole.role.id,
        nombre: userRole.role.nombre,
      },
      permissions,
    };
  }

  private async verifyTempToken(token: string): Promise<{ sub: string }> {
    try {
      const { payload } = await jwtVerify(token, encoder.encode(env.JWT_TEMP_SECRET), {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      if (payload.type !== "temp" || typeof payload.sub !== "string") {
        throw new HttpError(401, "INVALID_TEMP_TOKEN", "TempToken invalido");
      }

      return { sub: payload.sub };
    } catch {
      throw new HttpError(401, "INVALID_TEMP_TOKEN", "TempToken invalido o expirado");
    }
  }

  private async logAudit(data: {
    userId?: string | undefined;
    roleId?: string | undefined;
    action: AuditAction;
    detail?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<void> {
    const auditData: Prisma.AuditLogUncheckedCreateInput = {
      action: data.action,
      ...(data.userId !== undefined ? { userId: data.userId } : {}),
      ...(data.roleId !== undefined ? { roleId: data.roleId } : {}),
      ...(data.detail !== undefined ? { detail: data.detail } : {}),
      ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress } : {}),
      ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
      ...(data.userId !== undefined ? { creadoPor: data.userId, actualizadoPor: data.userId } : {}),
    };

    await this.db.auditLog.create({
      data: auditData,
    });
  }
}
