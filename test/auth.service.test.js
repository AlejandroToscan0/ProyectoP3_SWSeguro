import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
let AuthServiceCtor;
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
    const module = await import("../src/modules/auth/auth.service.js");
    AuthServiceCtor = module.AuthService;
});
describe("AuthService login", () => {
    it("retorna tempToken y roles para credenciales validas", async () => {
        const roleId = randomUUID();
        const userId = randomUUID();
        const passwordHash = await argon2.hash("SecurePass123!");
        const dbMock = {
            user: {
                findUnique: async () => ({
                    id: userId,
                    email: "user@example.com",
                    passwordHash,
                    estado: "ACTIVO",
                    userRoles: [
                        {
                            estado: "ACTIVO",
                            role: { id: roleId, nombre: "VENDEDOR", estado: "ACTIVO" },
                        },
                    ],
                }),
            },
            auditLog: {
                create: async () => ({}),
            },
        };
        const authService = new AuthServiceCtor(dbMock);
        const result = await authService.login({
            email: "user@example.com",
            password: "SecurePass123!",
        });
        expect(result.tempToken).toBeTypeOf("string");
        expect(result.roles).toEqual([{ id: roleId, nombre: "VENDEDOR" }]);
    });
});
//# sourceMappingURL=auth.service.test.js.map