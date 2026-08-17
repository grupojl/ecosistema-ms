// workers-backend/src/campaigns/campaigns.module.ts

import { Module }       from '@nestjs/common';
import { BullModule }   from '@nestjs/bullmq';
import { WORKER_QUEUES } from '../jobs/jobs.constants.js';
import { CampaignsController } from './campaigns.controller.js';
import { CampaignsService }    from './campaigns.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: WORKER_QUEUES.CAMPAIGN_EMAIL }),
  ],
  controllers: [CampaignsController],
  providers:   [CampaignsService],
  exports:     [CampaignsService],
})
export class CampaignsModule {}
