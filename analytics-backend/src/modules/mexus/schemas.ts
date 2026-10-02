import { z } from "zod";

export const OverviewQuerySchema = z.object({
  organizationId: z.string().min(1),
  ecosystemId:    z.string().min(1),
  from:           z.string().datetime(),
  to:             z.string().datetime(),
});

export type OverviewQueryInput = z.infer<typeof OverviewQuerySchema>;
