// workers-backend/src/campaigns/campaigns.module.ts
import { Module }                      from "@nestjs/common";
import { BullModule }                  from "@nestjs/bullmq";
import { CampaignsController }         from "@/campaigns/campaigns.controller.js";
import { CampaignsService }            from "@/campaigns/campaigns.service.js";
import { PrismaCampaignsRepository }   from "@/campaigns/repository/prisma-campaigns.repository.js";
import { CAMPAIGNS_REPOSITORY }        from "@/campaigns/repository/campaigns.repository.interface.js";
import { WORKER_QUEUES }               from "@/jobs/jobs.constants.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: WORKER_QUEUES.CAMPAIGN_EMAIL }),
  ],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    PrismaCampaignsRepository,
    { provide: CAMPAIGNS_REPOSITORY, useClass: PrismaCampaignsRepository },
  ],
  exports: [CampaignsService],
})
export class CampaignsModule {}
