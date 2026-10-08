import { Module }              from '@nestjs/common';
import { CampaignsService }    from '@/core/campaigns/campaigns.service.js';
import { CampaignsController } from '@/core/campaigns/campaigns.controller.js';

// Los processors y el scheduler viven en QueueModule (un solo dueño por processor).
@Module({
  providers:   [CampaignsService],
  controllers: [CampaignsController],
  exports:     [CampaignsService],
})
export class CampaignsModule {}
