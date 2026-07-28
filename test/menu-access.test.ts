import { describe, expect, it } from "vitest";
import { canAccessMenuUrl, requiredReadPermissionForUrl } from "../src/common/menu-access.js";

describe("menu-access", () => {
  it("resuelve permisos por URL conocida", () => {
    expect(requiredReadPermissionForUrl("/usuarios")).toBe("USERS_READ");
    expect(requiredReadPermissionForUrl("/reservas/hoteles")).toBe("RESERVAS_READ");
    expect(requiredReadPermissionForUrl("/ventas")).toBe("VENTAS_READ");
  });

  it("usa prefijo del módulo como fallback", () => {
    expect(requiredReadPermissionForUrl("/inventario", "Inventario Demo")).toBe("INVENTARIO_DEMO_READ");
  });

  it("permite grupos sin URL y bloquea sin permiso conocido", () => {
    expect(canAccessMenuUrl(null, ["USERS_READ"])).toBe(true);
    expect(canAccessMenuUrl("/usuarios", ["USERS_READ"])).toBe(true);
    expect(canAccessMenuUrl("/usuarios", ["ROLES_READ"])).toBe(false);
  });

  it("no oculta módulos nuevos si el permiso READ aún no existe en catálogo", () => {
    expect(canAccessMenuUrl("/inventario-demo", [], "Inventario Demo", new Set(["USERS_READ"]))).toBe(true);
    expect(
      canAccessMenuUrl("/inventario-demo", [], "Inventario Demo", new Set(["INVENTARIO_DEMO_READ"])),
    ).toBe(false);
    expect(canAccessMenuUrl("/inventario-demo", ["INVENTARIO_DEMO_READ"], "Inventario Demo")).toBe(true);
  });
});
