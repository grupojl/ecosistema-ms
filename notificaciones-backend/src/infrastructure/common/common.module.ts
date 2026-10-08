// notificaciones-backend/src/infrastructure/common/common.module.ts
// Servicios transversales (singleton): un solo CircuitBreakerService para adapters y /health.
import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';

@Global()
@Module({
  providers: [CircuitBreakerService],
  exports:   [CircuitBreakerService],
})
export class CommonModule {}
