import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ANALYTICS_EXPORT_QUEUE } from "@/core/analytics.constants.js";
import { ExportService } from "@/core/export/export.service.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: ANALYTICS_EXPORT_QUEUE }),
  ],
  providers: [ExportService],
  exports:   [ExportService],
})
export class ExportModule {}
