import { z } from "zod";

const nullableUrl = z
  .union([z.string().trim().url().max(500), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === "" || value === null) return null;
    return value;
  });

const nullableHealthPath = z
  .union([
    z
      .string()
      .trim()
      .max(200)
      .regex(/^\/.*/, "healthPath debe empezar con /"),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === "" || value === null) return null;
    return value;
  });

export const createModuleSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  descripcion: z.string().trim().max(500).optional(),
  baseUrl: nullableUrl,
  healthPath: nullableHealthPath,
});

export const updateModuleSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  descripcion: z.string().trim().max(500).nullable().optional(),
  baseUrl: nullableUrl,
  healthPath: nullableHealthPath,
});

export const assignModuleToRoleSchema = z.object({
  moduleId: z.string().uuid(),
});

export const listModulesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).default("ACTIVO"),
});

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type AssignModuleToRoleInput = z.infer<typeof assignModuleToRoleSchema>;
export type ListModulesInput = z.infer<typeof listModulesSchema>;
