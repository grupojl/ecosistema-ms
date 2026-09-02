// chatia-backend/src/agents/schemas.ts
// Reemplaza class-validator DTOs de agents.controller.ts
// Los schemas viven junto al módulo que los usa — no en una carpeta dto/ separada.
import { z } from 'zod';

export const RegisterAgentSchema = z.object({
  firebaseUid:    z.string().min(1),
  name:           z.string().min(1).max(100),
  email:          z.string().email(),
  organizationId: z.string().min(1).optional(),
  avatarUrl:      z.string().url().optional(),
});

export const UpdateAgentSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  isActive:  z.boolean().optional(),
  role:      z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).optional(),
});

export type RegisterAgentInput = z.infer<typeof RegisterAgentSchema>;
export type UpdateAgentInput   = z.infer<typeof UpdateAgentSchema>;
