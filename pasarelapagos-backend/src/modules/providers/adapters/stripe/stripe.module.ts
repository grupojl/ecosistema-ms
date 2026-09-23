import { Module } from '@nestjs/common';
import { StripeProvider } from '@/modules/providers/adapters/stripe/stripe.provider';
import { CircuitBreakerService } from '@/circuit-breaker.service';

@Module({
  providers: [StripeProvider, CircuitBreakerService],
  exports: [StripeProvider],
})
export class StripeModule {}
