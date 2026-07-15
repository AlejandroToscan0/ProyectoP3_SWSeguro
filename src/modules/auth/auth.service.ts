import argon2 from "argon2";
import { AuditAction, Estado, Prisma, type PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";
import { HttpError } from "../../common/http-error.js";
import type {
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  SelectRoleInput,
  ValidateTokenInput,
} from "./auth.schemas.js";

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

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  role: {
    id: string;
    nombre: string;
  };
  permissions: string[];
};

type ValidateTokenResponse = {
  válido: boolean;
  userId: string;
  roleId: string;
};

export const encoder = new TextEncoder();

async function signToken(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const jti = randomUUID();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setJti(jti)
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
        role: true,
      },
    });

    if (!userRole) {
      throw new HttpError(403, "ROLE_NOT_ALLOWED", "El rol seleccionado no es valido");
    }

    const rolePermissions = await this.db.rolePermission.findMany({
      where: {
        roleId: userRole.role.id,
        estado: Estado.ACTIVO,
        permission: { estado: Estado.ACTIVO },
      },
      include: {
        permission: true,
      },
    });

    const permissions = rolePermissions.map((rp: { permission: { codigo: string } }) => rp.permission.codigo);
    const session = await this.issueSession(userId, userRole.role.id, userRole.role.nombre, permissions);

    await this.logAudit({
      userId,
      roleId: userRole.role.id,
      action: AuditAction.ROLE_SELECTED,
      detail: `Rol activo: ${userRole.role.nombre}`,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      role: {
        id: userRole.role.id,
        nombre: userRole.role.nombre,
      },
      permissions,
    };
  }

  async refreshToken(
    input: RefreshTokenInput,
    meta?: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<RefreshResponse> {
    const { tokenId, tokenSecret } = this.parseRefreshToken(input.refreshToken);
    const stored = await this.db.refreshToken.findUnique({
      where: { id: tokenId },
      include: { role: true, user: true },
    });

    if (!stored || stored.estado !== Estado.ACTIVO || stored.user.estado !== Estado.ACTIVO) {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token invalido");
    }

    if (stored.revocado || stored.expiracion < new Date()) {
      await this.revokeAllUserRefreshTokens(stored.userId, "Reuso de refresh token revocado/expirado");
      await this.logAudit({
        userId: stored.userId,
        roleId: stored.roleId,
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        detail: "Intento de reutilizacion de refresh token",
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new HttpError(401, "REFRESH_TOKEN_REUSED", "Refresh token invalido");
    }

    const valid = await argon2.verify(stored.tokenHash, tokenSecret);
    if (!valid) {
      await this.logAudit({
        userId: stored.userId,
        roleId: stored.roleId,
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        detail: "Refresh token con hash no valido",
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token invalido");
    }

    const permissions: string[] = [];
    const session = await this.issueSession(stored.userId, stored.roleId, stored.role.nombre, permissions);

    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: {
        revocado: true,
        reemplazadoPor: session.refreshTokenId,
        actualizadoPor: stored.userId,
      },
    });

    await this.logAudit({
      userId: stored.userId,
      roleId: stored.roleId,
      action: AuditAction.TOKEN_REFRESHED,
      detail: "Refresh token rotado exitosamente",
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      role: {
        id: stored.roleId,
        nombre: stored.role.nombre,
      },
      permissions,
    };
  }

  async logout(
    input: LogoutInput,
    meta?: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<{ success: true }> {
    let userIdForAudit: string | undefined;
    let roleIdForAudit: string | undefined;

    if (input.refreshToken) {
      const parsed = this.parseRefreshToken(input.refreshToken);
      const stored = await this.db.refreshToken.findUnique({
        where: { id: parsed.tokenId },
      });

      if (stored) {
        const valid = await argon2.verify(stored.tokenHash, parsed.tokenSecret).catch(() => false);
        if (valid) {
          await this.db.refreshToken.update({
            where: { id: stored.id },
            data: { revocado: true, actualizadoPor: stored.userId },
          });
          userIdForAudit = stored.userId;
          roleIdForAudit = stored.roleId;
        }
      }
    }

    if (input.accessToken) {
      const payload = await this.verifyAccessToken(input.accessToken, false);
      userIdForAudit = userIdForAudit ?? payload.sub;
      roleIdForAudit = roleIdForAudit ?? payload.roleId;

      await this.db.tokenRevocation.upsert({
        where: { jti: payload.jti },
        update: {
          reason: "Logout",
          expiracion: new Date(payload.exp * 1000),
          actualizadoPor: payload.sub,
          estado: Estado.ACTIVO,
        },
        create: {
          jti: payload.jti,
          userId: payload.sub,
          reason: "Logout",
          expiracion: new Date(payload.exp * 1000),
          creadoPor: payload.sub,
          actualizadoPor: payload.sub,
        },
      });

      await this.logAudit({
        userId: payload.sub,
        roleId: payload.roleId,
        action: AuditAction.TOKEN_REVOKED,
        detail: "Access token revocado en logout",
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
    }

    await this.logAudit({
      userId: userIdForAudit,
      roleId: roleIdForAudit,
      action: AuditAction.LOGOUT,
      detail: "Logout exitoso",
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { success: true };
  }

  async validateToken(input: ValidateTokenInput): Promise<ValidateTokenResponse> {
    const payload = await this.verifyAccessToken(input.token, true);

    const requiredPermissions = input.requiredPermissions ?? [];
    const tokenPermissions = payload.permissions;
    const missingPermissions = requiredPermissions.filter((permission) => !tokenPermissions.includes(permission));

    if (missingPermissions.length > 0) {
      throw new HttpError(403, "INSUFFICIENT_PERMISSIONS", "Permisos insuficientes");
    }

    return {
      válido: true,
      userId: payload.sub,
      roleId: payload.roleId,
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

  private async verifyAccessToken(
    token: string,
    checkRevocation: boolean,
  ): Promise<{
    sub: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    exp: number;
    iat?: number;
    jti: string;
  }> {
    try {
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
        throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Access token invalido");
      }

      const permissions = payload.permissions.filter((p): p is string => typeof p === "string");
      if (permissions.length !== payload.permissions.length) {
        throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Access token invalido");
      }

      if (checkRevocation) {
        const revoked = await this.db.tokenRevocation.findUnique({
          where: { jti: payload.jti },
        });
        if (revoked && revoked.estado === Estado.ACTIVO && revoked.expiracion > new Date()) {
          throw new HttpError(401, "TOKEN_REVOKED", "Access token revocado");
        }
      }

      return {
        sub: payload.sub,
        roleId: payload.roleId,
        roleName: payload.roleName,
        permissions,
        exp: payload.exp,
        ...(typeof payload.iat === "number" ? { iat: payload.iat } : {}),
        jti: payload.jti,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Access token invalido o expirado");
    }
  }

  private parseRefreshToken(refreshToken: string): { tokenId: string; tokenSecret: string } {
    const [tokenId, tokenSecret] = refreshToken.split(".");
    if (!tokenId || !tokenSecret) {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Refresh token invalido");
    }
    return { tokenId, tokenSecret };
  }

  private async issueSession(
    userId: string,
    roleId: string,
    roleName: string,
    permissions: string[],
  ): Promise<{ accessToken: string; refreshToken: string; refreshTokenId: string }> {
    const accessToken = await signToken(
      {
        sub: userId,
        roleId,
        roleName,
        permissions,
        type: "access",
      },
      env.JWT_ACCESS_SECRET,
      env.ACCESS_TOKEN_TTL_SECONDS,
    );

    const refreshTokenId = randomUUID();
    const refreshTokenSecret = randomBytes(48).toString("base64url");
    const refreshTokenHash = await argon2.hash(refreshTokenSecret);

    await this.db.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId,
        roleId,
        tokenHash: refreshTokenHash,
        expiracion: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        creadoPor: userId,
        actualizadoPor: userId,
      },
    });

    return {
      accessToken,
      refreshToken: `${refreshTokenId}.${refreshTokenSecret}`,
      refreshTokenId,
    };
  }

  private async revokeAllUserRefreshTokens(userId: string, reason: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revocado: false },
      data: {
        revocado: true,
        actualizadoPor: userId,
      },
    });

    await this.logAudit({
      userId,
      action: AuditAction.TOKEN_REVOKED,
      detail: reason,
    });
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
