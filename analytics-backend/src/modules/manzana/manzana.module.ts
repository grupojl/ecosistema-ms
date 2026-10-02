import { Module }          from "@nestjs/common";
import { ManzanaController } from "@/modules/manzana/manzana.controller.js";
import { OverviewModule }    from "@/core/overview/overview.module.js";

@Module({
  imports:     [OverviewModule],
  controllers: [ManzanaController],
})
export class ManzanaModule {}
