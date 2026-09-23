import { Global, Module } from '@nestjs/common';
import { MetricsService } from '@/modules/metrics/metrics.service';

@Global()
@Module({
  providers: [MetricsService],
  exports:   [MetricsService],
})
export class MetricsModule {}
