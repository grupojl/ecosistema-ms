import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ANALYTICS_EVENTS_QUEUE } from "@/core/analytics.constants.js";
import { AnalyticsEventProcessor } from "@/core/events/events.processor.js";
import { OverviewModule } from "@/core/overview/overview.module.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: ANALYTICS_EVENTS_QUEUE }),
    OverviewModule,
  ],
  providers: [AnalyticsEventProcessor],
  exports:   [AnalyticsEventProcessor],
})
export class EventsModule {}
