import { z } from "zod";

export const createRoleSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  descripcion: z.string().trim().max(500).optional(),
});

export const updateRoleSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  descripcion: z.string().trim().max(500).optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});

export const assignUserToRoleSchema = z.object({
  userId: z.string().uuid(),
});

export const listRolesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignUserToRoleInput = z.infer<typeof assignUserToRoleSchema>;
export type ListRolesInput = z.infer<typeof listRolesSchema>;
