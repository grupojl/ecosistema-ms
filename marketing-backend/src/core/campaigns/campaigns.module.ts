import { Module }                   from '@nestjs/common';
import { CampaignsService }         from '@/core/campaigns/campaigns.service.js';
import { CampaignsController }      from '@/core/campaigns/campaigns.controller.js';
import { SyncMetricsProcessor }     from '@/queue/processors/sync-metrics.processor.js';
import { AutomationCheckProcessor } from '@/queue/processors/automation-check.processor.js';
import { CampaignScheduler }        from '@/campaigns/campaigns.scheduler.js';
import { AdAccountsModule }         from '@/ad-accounts/ad-accounts.module.js';

@Module({
  imports:     [AdAccountsModule],
  providers:   [CampaignsService, SyncMetricsProcessor, AutomationCheckProcessor, CampaignScheduler],
  controllers: [CampaignsController],
  exports:     [CampaignsService],
})
export class CampaignsModule {}
