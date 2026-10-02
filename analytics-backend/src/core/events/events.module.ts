import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ANALYTICS_EVENTS_QUEUE } from "@/core/analytics.constants.js";
import { EventsProcessor } from "@/core/events/events.processor.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: ANALYTICS_EVENTS_QUEUE }),
  ],
  providers: [EventsProcessor],
  exports:   [EventsProcessor],
})
export class EventsModule {}
