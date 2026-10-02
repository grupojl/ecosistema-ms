import { Module }              from "@nestjs/common";
import { WelverController } from "@/modules/welver/welver.controller.js";
import { CampaignsModule }     from "@/core/campaigns/campaigns.module.js";

@Module({
  imports:     [CampaignsModule],
  controllers: [WelverController],
})
export class WelverModule {}
