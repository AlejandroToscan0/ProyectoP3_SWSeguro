import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

let RoleServiceCtor: new (db: unknown) => {
  assignPermission: (
    roleId: string,
    input: { permissionId: string },
    assignedBy: string,
  ) => Promise<void>;
  delete: (id: string, deletedBy: string) => Promise<unknown>;
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3001";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_ISSUER = "master-auth-service";
  process.env.JWT_AUDIENCE = "microservices-platform";
  process.env.JWT_ACCESS_SECRET = "test_access_secret_with_32_chars_min";
  process.env.JWT_TEMP_SECRET = "test_temp_secret_with_32_chars_minn";
  process.env.ACCESS_TOKEN_TTL_SECONDS = "900";
  process.env.TEMP_TOKEN_TTL_SECONDS = "300";
  process.env.REFRESH_TOKEN_TTL_DAYS = "7";
  process.env.INTERNAL_API_KEY = "test_internal_api_key_with_32_chars";

  const module = await import("../src/modules/roles/roles.service.js");
  RoleServiceCtor = module.RoleService;
});

describe("RoleService", () => {
  it("asigna permiso a un rol activo", async () => {
    const roleId = randomUUID();
    const permissionId = randomUUID();
    let created = false;

    const dbMock = {
      role: {
        findUnique: async () => ({ id: roleId, estado: "ACTIVO" }),
      },
      permission: {
        findUnique: async () => ({ id: permissionId, codigo: "TEST_PERM", estado: "ACTIVO" }),
      },
      rolePermission: {
        findUnique: async () => null,
        create: async () => {
          created = true;
          return {};
        },
      },
      auditLog: {
        create: async () => ({}),
      },
    };

    const service = new RoleServiceCtor(dbMock);
    await service.assignPermission(roleId, { permissionId }, "tester");
    expect(created).toBe(true);
  });

  it("bloquea soft delete de rol con usuarios activos", async () => {
    const roleId = randomUUID();

    const dbMock = {
      role: {
        findUnique: async () => ({
          id: roleId,
          estado: "ACTIVO",
          userRoles: [{ id: randomUUID(), estado: "ACTIVO" }],
        }),
        update: async () => {
          throw new Error("no debería actualizar");
        },
      },
    };

    const service = new RoleServiceCtor(dbMock);
    await expect(service.delete(roleId, "tester")).rejects.toMatchObject({
      code: "ROLE_HAS_ACTIVE_USERS",
    });
  });
});
