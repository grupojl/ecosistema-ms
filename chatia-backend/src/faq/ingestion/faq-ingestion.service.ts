// chatia-backend/src/faq/ingestion/faq-ingestion.service.ts
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

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bullmq';
import { Queue }              from 'bullmq';
import { PrismaService }      from '../../prisma/prisma.service.js';

const FAQ_INGEST_QUEUE = 'workers.faq-ingest';

export interface EnqueueFaqIngestInput {
  ecosystemId:    string;
  organizationId: string;
  documentId:     string;
  knowledgeBaseId: string;
  source:         'URL' | 'BASE64' | 'TEXT';
  content:        string;
  fileName?:      string;
  embeddingModel?: string;
}

@Injectable()
export class FaqIngestionService {
  private readonly logger = new Logger(FaqIngestionService.name);

  constructor(
    @InjectQueue(FAQ_INGEST_QUEUE) private readonly ingestQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Encola un documento para indexación en workers-backend.
   * Retorna el jobId para que welver pueda consultar el estado.
   */
  async enqueueIngest(input: EnqueueFaqIngestInput): Promise<{ jobId: string }> {
    const { ecosystemId, organizationId, documentId, knowledgeBaseId } = input;

    // Marcar documento como PENDING en DB de chatia
    await this.prisma.kbDocument.update({
      where: { id: documentId },
      data:  { status: 'PROCESSING' },
    });

    // Encolar en workers-backend
    const job = await this.ingestQueue.add(
      'faq.ingest',
      {
        ecosystemId,
        organizationId,
        documentId,
        knowledgeBaseId,
        source:  input.source,
        content: input.content,
        fileName: input.fileName,
        embeddingModel: input.embeddingModel ?? 'nomic-embed-text-v1_5',
      },
      {
        attempts:         5,
        backoff:          { type: 'exponential', delay: 3_000 },
        removeOnComplete: 100,
        removeOnFail:     50,
      },
    );

    this.logger.log(
      `FAQ ingest encolado — doc:${documentId} job:${job.id} org:${organizationId}`,
    );

    return { jobId: job.id as string };
  }

  /**
   * Llamado por workers-backend via gRPC cuando termina el procesamiento.
   * Actualiza el estado del documento en la DB de chatia.
   */
  async updateDocumentStatus(params: {
    documentId:     string;
    organizationId: string;
    status:         'INDEXED' | 'FAILED';
    chunksIndexed?: number;
    error?:         string;
  }): Promise<void> {
    await this.prisma.kbDocument.update({
      where: { id: params.documentId },
      data: {
        status:    params.status,
        ...(params.chunksIndexed !== undefined && { chunkCount: params.chunksIndexed }),
        ...(params.error && { processingError: params.error }),
      },
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
    documentId:     string;
    organizationId: string;
    knowledgeBaseId: string;
    chunks: Array<{
      content:    string;
      embedding:  number[];
      chunkIndex: number;
      tokenCount: number;
    }>;
  }): Promise<{ chunksStored: number }> {
    // Eliminar chunks anteriores del documento (re-indexación)
    await this.prisma.kbChunk.deleteMany({
      where: { documentId: params.documentId },
    });

    // Insertar nuevos chunks
    await this.prisma.kbChunk.createMany({
      data: params.chunks.map(c => ({
        documentId:     params.documentId,
        knowledgeBaseId: params.knowledgeBaseId,
        organizationId: params.organizationId,
        content:        c.content,
        embedding:      c.embedding,
        chunkIndex:     c.chunkIndex,
        tokenCount:     c.tokenCount,
      })),
    });

    this.logger.log(
      `${params.chunks.length} chunks persistidos para doc:${params.documentId}`,
    );

    return { chunksStored: params.chunks.length };
  }
}
