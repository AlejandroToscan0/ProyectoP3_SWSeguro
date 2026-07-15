import { z } from "zod";

export const createModuleSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  descripcion: z.string().trim().max(500).optional(),
});

export const updateModuleSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  descripcion: z.string().trim().max(500).optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});

export const assignModuleToRoleSchema = z.object({
  moduleId: z.string().uuid(),
});

export const listModulesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type AssignModuleToRoleInput = z.infer<typeof assignModuleToRoleSchema>;
export type ListModulesInput = z.infer<typeof listModulesSchema>;
