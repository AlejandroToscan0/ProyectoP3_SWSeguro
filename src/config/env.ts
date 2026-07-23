import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_TEMP_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  TEMP_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  INTERNAL_API_KEY: z.string().min(32),
  ML_MODEL_NAME: z.string().default("mahdin70/CodeBERT-VulnCWE"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Configuracion de entorno invalida: ${details}`);
}

export const env = parsed.data;
