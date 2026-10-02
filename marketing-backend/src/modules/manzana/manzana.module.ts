import { Module }              from "@nestjs/common";
import { ManzanaController } from "@/modules/manzana/manzana.controller.js";
import { CampaignsModule }     from "@/core/campaigns/campaigns.module.js";

@Module({
  imports:     [CampaignsModule],
  controllers: [ManzanaController],
})
export class ManzanaModule {}
