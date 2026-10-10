// chatia-backend/src/config/validation.schema.ts
// Migrado de joi a zod (joi no está en las dependencias del proyecto)
import { z } from 'zod';

export const configValidationSchema = z.object({
  NODE_ENV:     z.enum(['development', 'production', 'test']).default('development'),
  PORT:         z.coerce.number().default(3010),
  DATABASE_URL: z.string().min(1),
  REDIS_URL:    z.string().default('redis://localhost:6379'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL:   z.string().optional(),
  JWT_SECRET:   z.string().optional(),
});

export type ConfigSchema = z.infer<typeof configValidationSchema>;

/** Para ConfigModule.forRoot({ validate }) — falla el arranque si falta una variable requerida. */
export function validateEnv(config: Record<string, unknown>): ConfigSchema {
  return configValidationSchema.parse(config);
}
