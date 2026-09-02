// chatia-backend/src/internal/schemas.ts
// Reemplaza InternalChatDto e InternalProjectDto con class-validator
import { z } from 'zod';

export const InternalChatSchema = z.object({
  projectSlug:    z.string().min(1).max(60),
  organizationId: z.string().min(1),
  userId:         z.string().min(1),
  message:        z.string().min(1).max(4096),
  channel:        z.string().default('api'),
});

export const InternalProjectSchema = z.object({
  slug:           z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  name:           z.string().min(1).max(100),
  organizationId: z.string().min(1),
  description:    z.string().max(500).optional(),
});

export type InternalChatInput    = z.infer<typeof InternalChatSchema>;
export type InternalProjectInput = z.infer<typeof InternalProjectSchema>;
