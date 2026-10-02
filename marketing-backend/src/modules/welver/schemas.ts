// marketing-backend/src/modules/welver/schemas.ts
import { z } from "zod";

export const CampaignQuerySchema = z.object({
  organizationId: z.string().min(1),
  ecosystemId:    z.string().min(1),
});

export type CampaignQueryInput = z.infer<typeof CampaignQuerySchema>;
