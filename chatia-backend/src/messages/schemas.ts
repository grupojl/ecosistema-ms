// chatia-backend/src/messages/schemas.ts
// Reemplaza PaginationDto con class-validator en messages.controller.ts
import { z } from 'zod';

export const PaginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;
