import { describe, expect, it } from "vitest";
import {
  assignPermissionToRoleSchema,
  listRolesSchema,
  updateRoleSchema,
} from "../src/modules/roles/roles.schemas.js";

describe("Role schemas", () => {
  it("valida assign permission", () => {
    const parsed = assignPermissionToRoleSchema.parse({
      permissionId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(parsed.permissionId).toContain("-");
  });

  it("lista roles con estado ACTIVO por defecto", () => {
    const parsed = listRolesSchema.parse({});
    expect(parsed.estado).toBe("ACTIVO");
  });

  it("no permite estado en update de rol", () => {
    const parsed = updateRoleSchema.parse({
      nombre: "ADMIN",
      estado: "INACTIVO",
    } as Record<string, unknown>);
    expect("estado" in parsed).toBe(false);
  });
});
