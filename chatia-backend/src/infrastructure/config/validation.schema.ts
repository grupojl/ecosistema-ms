// chatia-backend/src/config/validation.schema.ts
// Migrado de joi a zod (joi no está en las dependencias del proyecto)
import { z } from 'zod';

export const configValidationSchema = z.object({
  NODE_ENV:     z.enum(['development', 'production', 'test']).default('development'),
  PORT:         z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST:   z.string().default('localhost'),
  REDIS_PORT:   z.coerce.number().default(6379),
  GROQ_API_KEY: z.string().optional(),
  JWT_SECRET:   z.string().optional(),
});

export type ConfigSchema = z.infer<typeof configValidationSchema>;
