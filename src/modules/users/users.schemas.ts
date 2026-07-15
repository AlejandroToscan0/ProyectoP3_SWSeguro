import { z } from "zod";

export const createUserSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const updateUserSchema = z.object({
  nombre: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  password: z.string().min(8).max(128).optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
