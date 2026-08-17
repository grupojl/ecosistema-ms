// chatia-backend/src/faq/faq.module.ts
//
// ADR-003 W-1.3 semana 6: FaqIngestionService encola a workers.faq-ingest.
// El FaqIngestionProcessor local queda deprecated y se elimina en semana 7.

import { Module }                from '@nestjs/common';
import { BullModule }            from '@nestjs/bullmq';
import { FaqController }         from './faq.controller.js';
import { KnowledgeBaseService }  from './knowledge-base/knowledge-base.service.js';
import { KbDocumentService }     from './document/kb-document.service.js';
import { FaqIngestionService }   from './ingestion/faq-ingestion.service.js';
import { FaqIngestionProcessor } from './ingestion/faq-ingestion.processor.js';
import { FaqQueryService }       from './query/faq-query.service.js';
import { RagService }            from './rag/rag.service.js';
import { EmbeddingService }      from '../common/services/embedding.service.js';
import { CacheService }          from '../common/services/cache.service.js';
import { GroqModule }            from '../groq/groq.module.js';
import { QUEUES }                from '../queue/queue.constants.js';

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
  controllers: [FaqController],
  providers: [
    KnowledgeBaseService,
    KbDocumentService,
    FaqIngestionService,
    FaqIngestionProcessor, // deprecated — eliminar semana 7
    FaqQueryService,
    RagService,
    EmbeddingService,
    CacheService,
  ],
  exports: [FaqIngestionService, KnowledgeBaseService, KbDocumentService],
})
export class FaqModule {}
