// workers-backend/src/jobs/jobs.module.ts
import { Module }          from '@nestjs/common';
import { BullModule }      from '@nestjs/bullmq';
import { ConfigModule }    from '@nestjs/config';

import { WORKER_QUEUES, QUEUE_CONFIG }       from './jobs.constants.js';
import { JobsService }                       from './jobs.service.js';
import { JobsController }                    from './jobs.controller.js';
import { EmbeddingService }                  from './services/embedding.service.js';
import { ChunkingService }                   from './services/chunking.service.js';
import { FaqIngestProcessor }                from './processors/faq-ingest.processor.js';
import { VectorIndexProcessor }              from './processors/vector-index.processor.js';
import { CampaignEmailProcessor }            from './processors/campaign-email.processor.js';
import { AnalyticsExportProcessor }          from './processors/analytics-export.processor.js';

const ANALYTICS_EXPORT_QUEUE = 'workers.analytics-export';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: WORKER_QUEUES.FAQ_INGEST,        defaultJobOptions: QUEUE_CONFIG[WORKER_QUEUES.FAQ_INGEST] },
      { name: WORKER_QUEUES.VECTOR_INDEX,      defaultJobOptions: QUEUE_CONFIG[WORKER_QUEUES.VECTOR_INDEX] },
      { name: WORKER_QUEUES.CAMPAIGN_EMAIL,    defaultJobOptions: QUEUE_CONFIG[WORKER_QUEUES.CAMPAIGN_EMAIL] },
      { name: ANALYTICS_EXPORT_QUEUE },
      { name: WORKER_QUEUES.DLQ_FAQ_INGEST },
      { name: WORKER_QUEUES.DLQ_VECTOR_INDEX },
      { name: WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL },
      { name: 'notify.email' },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    EmbeddingService,
    ChunkingService,
    FaqIngestProcessor,
    VectorIndexProcessor,
    CampaignEmailProcessor,
    AnalyticsExportProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}
