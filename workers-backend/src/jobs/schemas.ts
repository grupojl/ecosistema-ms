// workers-backend/src/jobs/schemas.ts
// Reemplaza campaign-email-job.dto.ts y vector-index-job.dto.ts
// Estos son payloads de BullMQ — Zod los valida al procesar el job.
import { z } from 'zod';

export const CampaignEmailJobSchema = z.object({
  campaignId:     z.string().min(1),
  ecosystemId:    z.string().min(1),
  organizationId: z.string().min(1),
  contactId:      z.string().min(1),
  templateKey:    z.string().min(1),
  payload:        z.record(z.unknown()).default({}),
});

export const VectorIndexJobSchema = z.object({
  documentId:     z.string().min(1),
  knowledgeBaseId: z.string().min(1),
  organizationId: z.string().min(1),
  ecosystemId:    z.string().min(1),
  chunkSize:      z.number().int().min(100).max(2000).default(500),
  overlap:        z.number().int().min(0).max(200).default(50),
});

export type CampaignEmailJobInput = z.infer<typeof CampaignEmailJobSchema>;
export type VectorIndexJobInput   = z.infer<typeof VectorIndexJobSchema>;
