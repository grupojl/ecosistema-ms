// chatia-backend/src/core/faq/ingestion/faq-ingestion.processor.ts
//
// Consumidor de la cola `faq-ingest` (la que llena KbDocumentService al crear/reindexar un documento).
// Antes este archivo estaba vacío y los documentos quedaban en PENDING para siempre.
// Solo se registra con REDIS_ENABLED=true (ver FaqModule).
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';
import { FaqIndexerService } from '@/core/faq/ingestion/faq-indexer.service.js';
import type { IngestJobData } from '@/core/faq/document/kb-document.service.js';

@Processor(QUEUES.FAQ_INGEST, {
  concurrency: Number(process.env['FAQ_INGEST_CONCURRENCY'] ?? 2),
})
export class FaqIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(FaqIngestionProcessor.name);

  constructor(private readonly indexer: FaqIndexerService) {
    super();
  }

  async process(job: Job<IngestJobData>): Promise<{ chunks: number }> {
    return this.indexer.indexDocument(
      job.data.documentId,
      job.data.organizationId,
    );
  }

  /** Solo cuando se agotan los reintentos el documento pasa a FAILED (antes sigue en PROCESSING reintentando). */
  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<IngestJobData> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) return;
    const finalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.error(
      `[job:${job.id}] intento ${job.attemptsMade}/${job.opts.attempts ?? 1} falló: ${error.message}`,
    );
    if (finalAttempt) {
      await this.indexer
        .markFailed(job.data.documentId, job.data.organizationId, error.message)
        .catch((err: unknown) =>
          this.logger.error(
            `No se pudo marcar FAILED ${job.data.documentId}: ${String(err)}`,
          ),
        );
    }
  }
}
