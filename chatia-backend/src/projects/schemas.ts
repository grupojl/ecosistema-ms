// chatia-backend/src/projects/schemas.ts
import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name:        z.string().min(1).max(100),
  slug:        z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  isActive:    z.boolean().default(true),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
