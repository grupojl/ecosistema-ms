import { Module } from "@nestjs/common";
import { WelverController } from "@/modules/welver/welver.controller.js";
import { OverviewModule }   from "@/core/overview/overview.module.js";
import { ExportModule }     from "@/core/export/export.module.js";

@Module({
  imports:     [OverviewModule, ExportModule],
  controllers: [WelverController],
})
export class WelverModule {}
