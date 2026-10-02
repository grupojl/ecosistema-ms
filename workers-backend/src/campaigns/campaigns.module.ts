import { Module }              from "@nestjs/common";
import { CampaignsController } from "@/campaigns/campaigns.controller.js";
import { CampaignsModule as CoreCampaignsModule } from "@/core/campaigns/campaigns.module.js";

@Module({
  imports:     [CoreCampaignsModule],
  controllers: [CampaignsController],
})
export class CampaignsModule {}
