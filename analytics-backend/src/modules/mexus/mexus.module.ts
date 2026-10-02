import { Module }        from "@nestjs/common";
import { MexusController } from "@/modules/mexus/mexus.controller.js";
import { OverviewModule }  from "@/core/overview/overview.module.js";

@Module({
  imports:     [OverviewModule],
  controllers: [MexusController],
})
export class MexusModule {}
