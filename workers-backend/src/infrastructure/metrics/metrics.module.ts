// workers-backend/src/metrics/metrics.module.ts
import { Global, Module } from '@nestjs/common';
import { WorkersMetricsService } from '@/infrastructure/metrics/metrics.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';

@Global()
@Module({
  providers: [CircuitBreakerService, WorkersMetricsService],
  exports:   [CircuitBreakerService, WorkersMetricsService],
})
export class MetricsModule {}
