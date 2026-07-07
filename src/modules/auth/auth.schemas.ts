import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

export const selectRoleSchema = z.object({
  tempToken: z.string().min(20),
  roleId: z.string().uuid(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(30),
});

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(30).optional(),
    accessToken: z.string().min(20).optional(),
  })
  .refine((data) => !!data.refreshToken || !!data.accessToken, {
    message: "Debe enviar accessToken o refreshToken",
    path: ["refreshToken"],
  });

export const validateTokenSchema = z.object({
  token: z.string().min(20),
  requiredPermissions: z.array(z.string().min(1)).max(100).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SelectRoleInput = z.infer<typeof selectRoleSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ValidateTokenInput = z.infer<typeof validateTokenSchema>;
