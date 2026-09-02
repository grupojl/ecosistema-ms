// chatia-backend/src/webhooks/schemas.ts
import { z } from 'zod';

export const CreateWebhookSchema = z.object({
  url:        z.string().url(),
  events:     z.array(z.string().min(1)).min(1),
  secret:     z.string().min(16).optional(),
  isActive:   z.boolean().default(true),
  retryCount: z.number().int().min(0).max(10).default(3),
});

export const UpdateWebhookSchema = z.object({
  url:        z.string().url().optional(),
  events:     z.array(z.string().min(1)).optional(),
  secret:     z.string().min(16).optional(),
  isActive:   z.boolean().optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
});

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;
