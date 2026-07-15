import { z } from "zod";

export const createMenuSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  url: z.string().trim().max(500).nullable().optional(),
  moduleId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
});

export const updateMenuSchema = z.object({
  nombre: z.string().trim().min(1).max(255).optional(),
  url: z.string().trim().max(500).nullable().optional(),
  moduleId: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});

export const assignMenuToRoleSchema = z.object({
  menuId: z.string().uuid(),
});

export const listMenusSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
  moduleId: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
export type AssignMenuToRoleInput = z.infer<typeof assignMenuToRoleSchema>;
export type ListMenusInput = z.infer<typeof listMenusSchema>;
