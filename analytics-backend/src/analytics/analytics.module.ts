// analytics-backend/src/analytics/analytics.module.ts
import { Module }       from '@nestjs/common';
import { BullModule }   from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { ANALYTICS_EVENTS_QUEUE, ANALYTICS_EXPORT_QUEUE } from './analytics.constants.js';
import { AnalyticsController }     from './analytics.controller.js';
import { AnalyticsService }        from './analytics.service.js';
import { ExportService }           from './export.service.js';
import { AnalyticsEventProcessor } from './processors/analytics-event.processor.js';
import { ProjectionsService }      from './projections/projections.service.js';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: ANALYTICS_EVENTS_QUEUE },
      { name: ANALYTICS_EXPORT_QUEUE },
    ),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ExportService,
    AnalyticsEventProcessor,
    ProjectionsService,
  ],
  exports: [AnalyticsService, ExportService],
})
export class AnalyticsModule {}
