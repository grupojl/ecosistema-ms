import { Module }                             from "@nestjs/common";
import { CampaignsModule as CoreCampaignsModule } from "@/core/campaigns/campaigns.module.js";

// El módulo core es dueño del controller, service y repositorio (sin duplicados).
@Module({
  imports: [CoreCampaignsModule],
  exports: [CoreCampaignsModule],
})
export class CampaignsModule {}
