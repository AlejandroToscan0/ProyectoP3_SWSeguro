import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

let MenuServiceCtor: new (db: unknown) => {
  create: (
    input: {
      nombre: string;
      moduleId: string;
      parentId?: string | null;
      url?: string | null;
    },
    createdBy: string,
  ) => Promise<unknown>;
  update: (
    id: string,
    input: { parentId?: string | null; url?: string | null },
    updatedBy: string,
  ) => Promise<unknown>;
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

  const module = await import("../src/modules/menus/menus.service.js");
  MenuServiceCtor = module.MenuService;
});

describe("MenuService reglas de jerarquia", () => {
  it("rechaza crear hijo bajo un padre que tiene URL", async () => {
    const moduleId = randomUUID();
    const parentId = randomUUID();

    const dbMock = {
      module: {
        findUnique: async () => ({ id: moduleId, estado: "ACTIVO" }),
      },
      menu: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (where.id === parentId) {
            return {
              id: parentId,
              estado: "ACTIVO",
              moduleId,
              url: "/padre",
            };
          }
          return null;
        },
        count: async () => 0,
        create: async () => {
          throw new Error("no debería crear");
        },
      },
    };

    const service = new MenuServiceCtor(dbMock);

    await expect(
      service.create(
        {
          nombre: "Hijo",
          moduleId,
          parentId,
          url: "/hijo",
        },
        "tester",
      ),
    ).rejects.toMatchObject({
      code: "PARENT_MUST_BE_INTERMEDIATE",
    });
  });

  it("rechaza ciclos al actualizar parentId", async () => {
    const moduleId = randomUUID();
    const menuA = randomUUID();
    const menuB = randomUUID();

    const dbMock = {
      menu: {
        findUnique: async ({ where, select }: { where: { id: string }; select?: { parentId?: boolean } }) => {
          if (select?.parentId) {
            if (where.id === menuB) return { parentId: menuA };
            if (where.id === menuA) return { parentId: null };
            return null;
          }

          if (where.id === menuA) {
            return {
              id: menuA,
              estado: "ACTIVO",
              moduleId,
              parentId: null,
              url: null,
            };
          }

          if (where.id === menuB) {
            return {
              id: menuB,
              estado: "ACTIVO",
              moduleId,
              parentId: menuA,
              url: "/b",
            };
          }

          return null;
        },
        count: async () => 0,
        update: async () => {
          throw new Error("no debería actualizar");
        },
      },
    };

    const service = new MenuServiceCtor(dbMock);

    await expect(
      service.update(menuA, { parentId: menuB }, "tester"),
    ).rejects.toMatchObject({
      code: "WOULD_CREATE_CYCLE",
    });
  });
});
