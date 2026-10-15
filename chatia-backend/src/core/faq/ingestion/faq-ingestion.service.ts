// chatia-backend/src/core/faq/ingestion/faq-ingestion.service.ts
//
// ADR-003 W-1.3 — Extracción completada en semana 5.
// Este servicio es ahora UN PRODUCER PURO — no procesa nada.
// El procesamiento real ocurre en workers-backend/FaqIngestProcessor.
//
// Responsabilidades:
//   1. Recibir el documento (URL, base64, texto)
//   2. Actualizar estado del KbDocument a PENDING en DB
//   3. Encolar job en workers.faq-ingest
//   4. Retornar jobId para tracking desde welver

import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  KNOWLEDGE_REPOSITORY,
  type IKnowledgeRepository,
} from '@/core/faq/repository/knowledge.repository.interface.js';
import { FaqIndexerService } from '@/core/faq/ingestion/faq-indexer.service.js';

const FAQ_INGEST_QUEUE = 'workers.faq-ingest';

export interface EnqueueFaqIngestInput {
  ecosystemId: string;
  organizationId: string;
  documentId: string;
  knowledgeBaseId: string;
  source: 'URL' | 'BASE64' | 'TEXT';
  content: string;
  fileName?: string;
  embeddingModel?: string;
}

@Injectable()
export class FaqIngestionService {
  private readonly logger = new Logger(FaqIngestionService.name);

  constructor(
    @InjectQueue(FAQ_INGEST_QUEUE) private readonly ingestQueue: Queue,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repo: IKnowledgeRepository,
    private readonly indexer: FaqIndexerService,
  ) {}

  /**
   * Encola un documento para indexación en workers-backend.
   * Retorna el jobId para que welver pueda consultar el estado.
   */
  async enqueueIngest(
    input: EnqueueFaqIngestInput,
  ): Promise<{ jobId: string }> {
    const { ecosystemId, organizationId, documentId, knowledgeBaseId } = input;

    // Marcar documento como PENDING en DB de chatia
    await this.repo.markProcessing(documentId);

    // Encolar en workers-backend
    const job = await this.ingestQueue.add(
      'faq.ingest',
      {
        ecosystemId,
        organizationId,
        documentId,
        knowledgeBaseId,
        source: input.source,
        content: input.content,
        fileName: input.fileName,
        embeddingModel: input.embeddingModel ?? 'nomic-embed-text-v1_5',
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 3_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(
      `FAQ ingest encolado — doc:${documentId} job:${job.id} org:${organizationId}`,
    );

    return { jobId: job.id ?? 'unknown' };
  }

  /**
   * Llamado por workers-backend via gRPC cuando termina el procesamiento.
   * Actualiza el estado del documento en la DB de chatia.
   */
  async updateDocumentStatus(params: {
    documentId: string;
    organizationId: string;
    status: 'INDEXED' | 'FAILED';
    chunksIndexed?: number;
    error?: string;
  }): Promise<void> {
    // scoped por organización: un servicio interno no puede tocar documentos de otra organización
    await this.repo.applyStatus(params.documentId, params.organizationId, {
      status: params.status,
      chunksIndexed: params.chunksIndexed,
      error: params.error,
    });

    this.logger.log(
      `KbDocument ${params.documentId} actualizado → ${params.status}` +
        (params.chunksIndexed ? ` (${params.chunksIndexed} chunks)` : ''),
    );
  }

  /**
   * Persiste chunks en la DB de chatia.
   * Llamado via gRPC desde workers-backend/FaqIngestProcessor.
   */
  async upsertChunks(params: {
    documentId: string;
    organizationId: string;
    knowledgeBaseId: string;
    chunks: Array<{
      content: string;
      embedding: number[];
      chunkIndex: number;
      tokenCount: number;
    }>;
  }): Promise<{ chunksStored: number }> {
    // El indexador verifica que el documento sea de la organización, reemplaza los fragmentos
    // (re-indexación) y guarda el vector en pgvector. Antes se pasaban campos que KbChunk no tiene
    // (knowledgeBaseId, organizationId, tokenCount) y Prisma rechazaba la inserción.
    const chunksStored = await this.indexer.replaceChunks(
      params.documentId,
      params.organizationId,
      params.chunks,
    );

    this.logger.log(
      `${chunksStored} chunks persistidos para doc:${params.documentId}`,
    );

    return { chunksStored };
  }
}
