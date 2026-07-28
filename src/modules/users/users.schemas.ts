import { z } from "zod";

const strongPasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
  .regex(/[a-z]/, "Debe incluir al menos una minúscula")
  .regex(/[0-9]/, "Debe incluir al menos un número");

export const createUserSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  email: z.string().trim().email().toLowerCase(),
  password: strongPasswordSchema,
});

export const updateUserSchema = z.object({
  nombre: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  password: strongPasswordSchema.optional(),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO"]).default("ACTIVO"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
