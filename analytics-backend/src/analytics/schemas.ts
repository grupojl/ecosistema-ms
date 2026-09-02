// analytics-backend/src/analytics/schemas.ts
import { z } from 'zod';

export const ExportSchema = z.object({
  organizationId: z.string(),
  ecosystemId:    z.string(),
  from:           z.string().datetime(),
  to:             z.string().datetime(),
  format:         z.enum(['csv', 'json']).default('csv'),
});

export type ExportInput = z.infer<typeof ExportSchema>;
