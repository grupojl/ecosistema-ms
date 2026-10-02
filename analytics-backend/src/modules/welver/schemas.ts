// analytics-backend/src/modules/welver/schemas.ts
// Zod schemas para los endpoints de welver
import { z } from "zod";

export const OverviewQuerySchema = z.object({
  organizationId: z.string().min(1),
  ecosystemId:    z.string().min(1),
  from:           z.string().datetime(),
  to:             z.string().datetime(),
});

export const AgentsQuerySchema = OverviewQuerySchema.extend({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ExportSchema = z.object({
  organizationId: z.string().min(1),
  ecosystemId:    z.string().min(1),
  from:           z.string().datetime(),
  to:             z.string().datetime(),
  format:         z.enum(["csv", "json"]).default("csv"),
});

export type OverviewQueryInput = z.infer<typeof OverviewQuerySchema>;
export type AgentsQueryInput   = z.infer<typeof AgentsQuerySchema>;
export type ExportInput        = z.infer<typeof ExportSchema>;
