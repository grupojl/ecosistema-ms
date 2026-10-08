// workers-backend/src/core/jobs/job-data.types.ts
// Contratos de payload/resultado de los jobs BullMQ (ver .claude/contracts/bullmq-queues.md)

export interface CampaignEmailJobData {
  campaignId:     string;
  ecosystemId:    string;
  organizationId: string;
  templateKey:    string;
  recipientIds:   string[];
  variables?:     Record<string, string>;
  /** Posición de reanudación si el job se reintenta */
  cursor?:        number;
}

export interface CampaignEmailJobResult {
  campaignId:  string;
  totalSent:   number;
  totalFailed: number;
  durationMs:  number;
}

export interface VectorIndexChunk {
  content:    string;
  chunkIndex: number;
  tokenCount: number;
}

export interface VectorIndexJobData {
  ecosystemId:     string;
  organizationId:  string;
  documentId:      string;
  knowledgeBaseId: string;
  chunks:          VectorIndexChunk[];
}

export interface VectorIndexJobResult {
  documentId:    string;
  chunksIndexed: number;
  durationMs:    number;
}
