import { describe, expect, it } from "vitest";
import {
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  selectRoleSchema,
  validateTokenSchema,
} from "../src/modules/auth/auth.schemas.js";

describe("Auth schemas", () => {
  it("valida payload de login correcto", () => {
    const parsed = loginSchema.parse({
      email: "user@example.com",
      password: "SecurePass123!",
    });

    expect(parsed.email).toBe("user@example.com");
  });

  it("rechaza roleId invalido en select-role", () => {
    expect(() =>
      selectRoleSchema.parse({
        tempToken: "some-valid-temp-token",
        roleId: "not-a-uuid",
      }),
    ).toThrow();
  });

  it("valida payload de refresh-token", () => {
    const parsed = refreshTokenSchema.parse({
      refreshToken: "123e4567-e89b-12d3-a456-426614174000.token-secreto-super-largo",
    });
    expect(parsed.refreshToken).toContain(".");
  });

  it("requiere al menos un token en logout", () => {
    expect(() => logoutSchema.parse({})).toThrow();
    expect(
      logoutSchema.parse({
        accessToken: "access-token-largo-para-logout",
      }).accessToken,
    ).toBe("access-token-largo-para-logout");
  });

  it("valida requiredPermissions opcional en validate-token", () => {
    const parsed = validateTokenSchema.parse({
      token: "token-largo-para-validar",
      requiredPermissions: ["VENTAS_READ"],
    });
    expect(parsed.requiredPermissions).toEqual(["VENTAS_READ"]);
  });
});
