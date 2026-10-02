import { Module } from "@nestjs/common";
import { ProjectionsService } from "@/core/projections/projections.service.js";

@Module({
  providers: [ProjectionsService],
  exports:   [ProjectionsService],
})
export class ProjectionsModule {}
