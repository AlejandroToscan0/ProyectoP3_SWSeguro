import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export const selectRoleSchema = z.object({
  tempToken: z.string().min(20),
  roleId: z.string().uuid(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SelectRoleInput = z.infer<typeof selectRoleSchema>;
