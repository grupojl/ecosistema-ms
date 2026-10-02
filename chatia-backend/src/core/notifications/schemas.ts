// chatia-backend/src/notifications/schemas.ts
import { z } from 'zod';

export const ListNotificationsSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  read:  z.coerce.boolean().optional(),
});

export type ListNotificationsInput = z.infer<typeof ListNotificationsSchema>;
