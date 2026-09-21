import { Module }                   from '@nestjs/common';
import { CampaignsService }         from './campaigns.service.js';
import { CampaignsController }      from './campaigns.controller.js';
import { SyncMetricsProcessor }     from './processors/sync-metrics.processor.js';
import { AutomationCheckProcessor } from './processors/automation-check.processor.js';
import { CampaignScheduler }        from './campaigns.scheduler.js';
import { AdAccountsModule }         from '../ad-accounts/ad-accounts.module.js';

@Module({
  imports:     [AdAccountsModule],
  providers:   [CampaignsService, SyncMetricsProcessor, AutomationCheckProcessor, CampaignScheduler],
  controllers: [CampaignsController],
  exports:     [CampaignsService],
})
export class CampaignsModule {}
