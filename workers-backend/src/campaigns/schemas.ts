// workers-backend/src/campaigns/schemas.ts
// Reemplaza campaign.dto.ts con class-validator
import { z } from 'zod';

export const CreateCampaignSchema = z.object({
  name:           z.string().min(1).max(150),
  ecosystemId:    z.string().min(1),
  organizationId: z.string().min(1),
  templateKey:    z.string().min(1),
  channel:        z.enum(['WHATSAPP', 'EMAIL', 'PUSH']),
  segmentFilter:  z.record(z.unknown()).default({}),
  scheduledAt:    z.coerce.date().optional(),
  metadata:       z.record(z.unknown()).default({}),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
