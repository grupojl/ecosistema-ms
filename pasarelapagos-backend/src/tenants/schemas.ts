// pasarelapagos-backend/src/modules/tenants/schemas.ts
import { z } from 'zod';

export const CreateApiKeySchema = z.object({
  name:      z.string().min(1).max(100),
  expiresIn: z.number().int().min(1).max(365).optional(), // días
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
