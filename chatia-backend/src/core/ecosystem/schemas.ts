// chatia-backend/src/ecosystem/schemas.ts
import { z } from 'zod';

export const RegisterEcosystemSchema = z.object({
  ecosystemId: z.string().min(1).max(100),
  name:        z.string().min(1).max(150),
  apiKey:      z.string().min(32),
  webhookUrl:  z.string().url().optional(),
  metadata:    z.record(z.unknown()).default({}),
});

export type RegisterEcosystemInput = z.infer<typeof RegisterEcosystemSchema>;
