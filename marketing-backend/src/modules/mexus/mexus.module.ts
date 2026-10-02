import { Module }              from "@nestjs/common";
import { MexusController } from "@/modules/mexus/mexus.controller.js";
import { CampaignsModule }     from "@/core/campaigns/campaigns.module.js";

@Module({
  imports:     [CampaignsModule],
  controllers: [MexusController],
})
export class MexusModule {}
