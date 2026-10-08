// marketing-backend/src/queue/queue.module.ts
// Dueño ÚNICO de las colas BullMQ, sus processors y el scheduler (evita processors duplicados).
// Queue names: marketing.constants.ts (fuente de verdad) — ref .claude/contracts/bullmq-queues.md
import { Module }                       from '@nestjs/common';
import { BullModule }                   from '@nestjs/bullmq';
import { MARKETING_QUEUES }             from '@/marketing.constants.js';
import { AutomationCheckProcessor }     from '@/queue/processors/automation-check.processor.js';
import { SyncMetricsProcessor }         from '@/queue/processors/sync-metrics.processor.js';
import { AttributeConversionProcessor } from '@/queue/processors/attribute-conversion.processor.js';
import { CampaignScheduler }            from '@/campaigns/campaigns.scheduler.js';
import { AdAccountsModule }             from '@/core/ad-accounts/ad-accounts.module.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: MARKETING_QUEUES.CAMPAIGN_AUTOMATION },
      { name: MARKETING_QUEUES.CAMPAIGN_SYNC },
      { name: MARKETING_QUEUES.MARKETING_ATTRIBUTION },
    ),
    AdAccountsModule, // exporta AD_PLATFORM_TOKENS.META para los processors
  ],
  providers: [
    AutomationCheckProcessor,
    SyncMetricsProcessor,
    AttributeConversionProcessor,
    CampaignScheduler,
  ],
})
export class QueueModule {}
