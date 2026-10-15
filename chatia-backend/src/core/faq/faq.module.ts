// chatia-backend/src/core/faq/faq.module.ts
//
// ADR-003 W-1.3 semana 6: FaqIngestionService encola a workers.faq-ingest.
// El FaqIngestionProcessor local queda deprecated y se elimina en semana 7.

import { GroqModule } from '@/infrastructure/groq/groq.module.js';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeBaseService } from '@/core/faq/knowledge-base/knowledge-base.service.js';
import { KbDocumentService } from '@/core/faq/document/kb-document.service.js';
import { FaqIngestionService } from '@/core/faq/ingestion/faq-ingestion.service.js';
import { FaqIngestionProcessor } from '@/core/faq/ingestion/faq-ingestion.processor.js';
import { FaqQueryService } from '@/core/faq/query/faq-query.service.js';
import { FaqIndexerService } from '@/core/faq/ingestion/faq-indexer.service.js';
import { KbVectorStore } from '@/core/faq/vector/kb-vector.store.js';
import { RagService } from '@/core/faq/rag/rag.service.js';
import { EmbeddingService } from '@/infrastructure/common/services/embedding.service.js';
import { CacheService } from '@/infrastructure/common/services/cache.service.js';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

// Queue de workers-backend — chatia solo encola aquí (producer puro)
const WORKERS_FAQ_INGEST = 'workers.faq-ingest';

@Module({
  imports: [
    GroqModule,
    BullModule.registerQueue(
      // Queue local legacy (deprecated) — mantener mientras FaqIngestionProcessor existe
      { name: QUEUES.FAQ_INGEST ?? 'faq-ingest' },
      // Queue de workers-backend — nuevo destino de ingestión
      { name: WORKERS_FAQ_INGEST },
    ),
  ],
  providers: [
    KnowledgeBaseService,
    KbDocumentService,
    FaqIngestionService,
    FaqIndexerService,
    KbVectorStore,
    // Consumidor de la cola local `faq-ingest` (indexación real). Requiere Redis.
    ...(REDIS_ENABLED ? [FaqIngestionProcessor] : []),
    FaqQueryService,
    RagService,
    EmbeddingService,
    CacheService,
  ],
  exports: [
    FaqIngestionService,
    FaqIndexerService,
    KbVectorStore,
    KnowledgeBaseService,
    KbDocumentService,
    RagService,
  ],
})
export class FaqModule {}
