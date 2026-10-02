import { Module } from "@nestjs/common";
import { OverviewService } from "@/core/overview/overview.service.js";

@Module({
  providers: [OverviewService],
  exports:   [OverviewService],
})
export class OverviewModule {}
