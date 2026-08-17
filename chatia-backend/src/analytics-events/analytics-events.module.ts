// chatia-backend/src/analytics-events/analytics-events.module.ts
import { Module }       from '@nestjs/common';
import { BullModule }   from '@nestjs/bullmq';
import { ANALYTICS_QUEUE, AnalyticsEventsService } from './analytics-events.service.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: ANALYTICS_QUEUE,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50, attempts: 1 },
    }),
  ],
  providers: [AnalyticsEventsService],
  exports:   [AnalyticsEventsService],
})
export class AnalyticsEventsModule {}
