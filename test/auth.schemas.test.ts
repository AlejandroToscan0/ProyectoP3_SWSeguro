import { describe, expect, it } from "vitest";
import { loginSchema, selectRoleSchema } from "../src/modules/auth/auth.schemas.js";

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
});
