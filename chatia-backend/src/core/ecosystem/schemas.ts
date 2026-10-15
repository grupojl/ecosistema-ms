// chatia-backend/src/core/ecosystem/schemas.ts
import { z } from 'zod';

/**
 * Configuración libre de un ecosistema (la lee la strategy). Se validan las claves conocidas y se acota el tamaño,
 * para que el endpoint de plataforma no guarde JSON arbitrario o enorme. `projectType` no es un enum cerrado a propósito:
 * un ecosistema nuevo no debería requerir tocar este archivo (ADR-022).
 */
export const EcosystemConfigSchema = z
  .object({
    projectType: z
      .string()
      .regex(/^[a-z0-9_-]{1,40}$/, 'projectType: minúsculas, números, - o _')
      .optional(),
    plan: z.string().max(50).optional(),
    category: z.string().max(100).optional(),
    markets: z.array(z.string().length(2)).max(50).optional(),
    storeUrl: z.string().url().max(500).nullable().optional(),
  })
  .catchall(z.unknown())
  .refine((cfg) => JSON.stringify(cfg).length <= 16_384, {
    message: 'config demasiado grande (máx. 16 KB)',
  });

export const RegisterEcosystemSchema = z.object({
  firebaseProjectId: z.string().min(1).max(128),
  name: z.string().min(1).max(150),
  config: EcosystemConfigSchema.default({}),
});

export type EcosystemConfigInput = z.infer<typeof EcosystemConfigSchema>;
export type RegisterEcosystemInput = z.infer<typeof RegisterEcosystemSchema>;
