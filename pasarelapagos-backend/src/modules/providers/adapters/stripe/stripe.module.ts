import { Module } from '@nestjs/common';
import { StripeProvider } from '@/modules/providers/adapters/stripe/stripe.provider.js';
import { CircuitBreakerService } from '@/circuit-breaker.service.js';

@Module({
  providers: [StripeProvider, CircuitBreakerService],
  exports: [StripeProvider],
})
export class StripeModule {}
