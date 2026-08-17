// workers-backend/src/jobs/processors/vector-index.processor.ts
//
// W-2.1: Indexación de vectores en paralelo con límite de concurrencia.
// Recibe chunks ya extraídos → genera embeddings → persiste en chatia via gRPC.
//
// SLA: 1000 chunks indexados en < 30s.
// NOTA: Si se adopta Qdrant (ADR-006), solo cambiar el adapter gRPC destino.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject }        from '@nestjs/common';
import { ClientGrpc }            from '@nestjs/microservices';
import type { Job }              from 'bullmq';
import { firstValueFrom }        from 'rxjs';

import { WORKER_QUEUES, QUEUE_CONFIG } from '../jobs.constants.js';
import { JobsService }                 from '../jobs.service.js';
import { EmbeddingService }            from '../services/embedding.service.js';
import type {
  VectorIndexJobData,
  VectorIndexJobResult,
}                                      from '../dto/vector-index-job.dto.js';

const EMBED_CONCURRENCY = 5; // paralelo para generación de embeddings

interface ChatiaGrpcClient {
  upsertChunks(req: object): { toPromise: () => Promise<{ success: boolean; chunksStored: number }> };
}

@Processor(WORKER_QUEUES.VECTOR_INDEX, {
  concurrency: QUEUE_CONFIG[WORKER_QUEUES.VECTOR_INDEX].concurrency,
})
export class VectorIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(VectorIndexProcessor.name);
  private chatiaClient!: ChatiaGrpcClient;

  constructor(
    private readonly jobs:      JobsService,
    private readonly embedding: EmbeddingService,
    @Inject('CHATIA_GRPC_CLIENT') private readonly grpc: ClientGrpc,
  ) {
    super();
  }

  onModuleInit(): void {
    this.chatiaClient = this.grpc.getService<ChatiaGrpcClient>('ChatIaService');
  }

  async process(job: Job<VectorIndexJobData>): Promise<VectorIndexJobResult> {
    const { ecosystemId, organizationId, documentId, knowledgeBaseId, chunks } = job.data;
    const startedAt = Date.now();

    this.logger.log(`[${job.id}] VectorIndex — doc:${documentId} chunks:${chunks.length}`);

    await this.jobs.updateJobLog(job.id as string, {
      status:    'PROCESSING',
      startedAt: new Date(startedAt),
      attempts:  job.attemptsMade + 1,
    });

    try {
      // Generar embeddings en batches paralelos (límite EMBED_CONCURRENCY)
      const texts      = chunks.map(c => c.content);
      const embeddings = await this.generateEmbeddingsParallel(texts);

      // Persistir en chatia via gRPC
      const result = await firstValueFrom(
        // @ts-expect-error — rxjs interop
        this.chatiaClient.upsertChunks({
          documentId,
          organizationId,
          knowledgeBaseId,
          chunks: chunks.map((c, idx) => ({
            content:    c.content,
            embedding:  embeddings[idx]!,
            chunkIndex: c.chunkIndex,
            tokenCount: c.tokenCount,
          })),
        }),
      ) as { success: boolean; chunksStored: number };

      const durationMs = Date.now() - startedAt;
      const output: VectorIndexJobResult = {
        documentId,
        chunksIndexed: result.chunksStored,
        durationMs,
      };

      await this.jobs.updateJobLog(job.id as string, {
        status:      'DONE',
        completedAt: new Date(),
        durationMs,
        result:      output as unknown as Record<string, unknown>,
      });

      // SLA check — warning si supera 30s
      if (durationMs > 30_000) {
        this.logger.warn(
          `[${job.id}] SLA superado: ${durationMs}ms para ${chunks.length} chunks (SLA: 30s)`,
        );
      }

      this.logger.log(`[${job.id}] Completado — ${result.chunksStored} chunks en ${durationMs}ms`);
      return output;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startedAt;

      await this.jobs.updateJobLog(job.id as string, {
        status:      'FAILED',
        completedAt: new Date(),
        durationMs,
        error:       message,
      });

      throw error;
    }
  }

  // ── Embeddings con concurrencia controlada ────────────────────────────────

  private async generateEmbeddingsParallel(texts: string[]): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    const tasks               = texts.map((text, idx) => ({ text, idx }));

    for (let i = 0; i < tasks.length; i += EMBED_CONCURRENCY) {
      const batch    = tasks.slice(i, i + EMBED_CONCURRENCY);
      const resolved = await Promise.all(
        batch.map(t => this.embedding.embed(t.text)),
      );
      resolved.forEach((emb, j) => {
        results[batch[j]!.idx] = emb;
      });
    }

    return results;
  }
}
