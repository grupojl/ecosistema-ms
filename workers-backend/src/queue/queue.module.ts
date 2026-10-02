// workers-backend/src/queue/queue.module.ts
import { Module }   from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { WORKER_QUEUES } from "@/queue/queue.constants.js";
import { AnalyticsExportProcessor } from "@/queue/processors/analytics-export.processor.js";
import { CampaignEmailProcessor }   from "@/queue/processors/campaign-email.processor.js";
import { FaqIngestProcessor }       from "@/queue/processors/faq-ingest.processor.js";
import { VectorIndexProcessor }     from "@/queue/processors/vector-index.processor.js";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: WORKER_QUEUES.CAMPAIGN_EMAIL },
      { name: WORKER_QUEUES.FAQ_INGEST },
      { name: WORKER_QUEUES.VECTOR_INDEX },
      { name: WORKER_QUEUES.ANALYTICS_EXPORT },
    ),
  ],
  providers: [
    AnalyticsExportProcessor,
    CampaignEmailProcessor,
    FaqIngestProcessor,
    VectorIndexProcessor,
  ],
})
export class QueueModule {}
