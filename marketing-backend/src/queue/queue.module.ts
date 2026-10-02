// marketing-backend/src/queue/queue.module.ts
import { Module }   from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MARKETING_QUEUES } from "@/queue/queue.constants.js";
import { AutomationCheckProcessor }     from "@/queue/processors/automation-check.processor.js";
import { SyncMetricsProcessor }         from "@/queue/processors/sync-metrics.processor.js";
import { AttributeConversionProcessor } from "@/queue/processors/attribute-conversion.processor.js";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: MARKETING_QUEUES.CAMPAIGN_AUTOMATION },
      { name: MARKETING_QUEUES.CAMPAIGN_SYNC },
      { name: MARKETING_QUEUES.ATTRIBUTION },
    ),
  ],
  providers: [
    AutomationCheckProcessor,
    SyncMetricsProcessor,
    AttributeConversionProcessor,
  ],
})
export class QueueModule {}
