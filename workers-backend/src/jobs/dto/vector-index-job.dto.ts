// workers-backend/src/jobs/dto/vector-index-job.dto.ts

export interface VectorChunk {
  content:    string;
  chunkIndex: number;
  tokenCount: number;
}

export interface VectorIndexJobData {
  ecosystemId:    string;
  organizationId: string;
  documentId:     string;
  knowledgeBaseId: string;
  chunks:         VectorChunk[];
  embeddingModel?: string;
}

export interface VectorIndexJobResult {
  documentId:     string;
  chunksIndexed:  number;
  durationMs:     number;
}
