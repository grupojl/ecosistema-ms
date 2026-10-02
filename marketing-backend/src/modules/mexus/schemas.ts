// marketing-backend/src/modules/mexus/schemas.ts
import { z } from "zod";

export const CampaignQuerySchema = z.object({
  organizationId: z.string().min(1),
  ecosystemId:    z.string().min(1),
});

export type CampaignQueryInput = z.infer<typeof CampaignQuerySchema>;
