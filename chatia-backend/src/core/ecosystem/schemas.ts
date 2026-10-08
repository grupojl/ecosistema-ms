// chatia-backend/src/ecosystem/schemas.ts
import { z } from 'zod';

export const RegisterEcosystemSchema = z.object({
  firebaseProjectId: z.string().min(1).max(128),
  name:              z.string().min(1).max(150),
  config:            z.record(z.string(), z.unknown()).default({}),
});

export type RegisterEcosystemInput = z.infer<typeof RegisterEcosystemSchema>;
