// chatia-backend/src/analytics/analytics.module.ts
// DEPRECATED — eliminar en semana 7 post-migración de welver.
import { Module }             from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService }    from './analytics.service.js';

@Module({
  controllers: [AnalyticsController],
  providers:   [AnalyticsService],
})
export class AnalyticsModule {}
