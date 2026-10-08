import { Module } from '@nestjs/common';
import { StripeProvider } from '@/infrastructure/providers/adapters/stripe/stripe.provider.js';
import { CircuitBreakerService } from '@/infrastructure/providers/circuit-breaker.service.js';

@Module({
  providers: [StripeProvider, CircuitBreakerService],
  exports: [StripeProvider],
})
export class StripeModule {}
