import { describe, expect, it } from "vitest";
import { createMenuSchema, updateMenuSchema, assignMenuToRoleSchema } from "../src/modules/menus/menus.schemas.js";

describe("Menu schemas", () => {
  it("acepta create con orden e icono", () => {
    const parsed = createMenuSchema.parse({
      nombre: "Ventas",
      moduleId: "123e4567-e89b-12d3-a456-426614174000",
      url: "/ventas",
      orden: 2,
      icono: "cart",
    });

    expect(parsed.orden).toBe(2);
    expect(parsed.icono).toBe("cart");
  });

  it("rechaza moduleId invalido", () => {
    expect(() =>
      createMenuSchema.parse({
        nombre: "Ventas",
        moduleId: "no-uuid",
      }),
    ).toThrow();
  });

  it("no permite estado en update (mass assignment)", () => {
    const parsed = updateMenuSchema.parse({
      nombre: "Ventas",
      estado: "INACTIVO",
    } as Record<string, unknown>);

    expect("estado" in parsed).toBe(false);
  });

  it("valida assign menu a rol", () => {
    const parsed = assignMenuToRoleSchema.parse({
      menuId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(parsed.menuId).toBeTypeOf("string");
  });
});
