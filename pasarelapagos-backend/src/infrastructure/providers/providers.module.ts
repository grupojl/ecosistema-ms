import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ProviderRegistry } from '@/infrastructure/providers/provider.registry.js';
import { CircuitBreakerService } from '@/infrastructure/providers/circuit-breaker.service.js';
import { RoutingService } from '@/core/routing/routing.service.js';
// Adapters
import { StripeModule } from '@/infrastructure/providers/adapters/stripe/stripe.module.js';
import { MercadoPagoModule } from '@/infrastructure/providers/adapters/mercadopago/mercadopago.module.js';
import { PagarmeModule } from '@/infrastructure/providers/adapters/pagarme/pagarme.module.js';
import { ConektaModule } from '@/infrastructure/providers/adapters/conekta/conekta.module.js';
import { DlocalModule } from '@/infrastructure/providers/adapters/dlocal/dlocal.module.js';

@Global()
@Module({
  imports: [
    CacheModule.register({ ttl: 5 * 60 * 1000, max: 100 }),
    StripeModule,
    MercadoPagoModule,
    PagarmeModule,
    ConektaModule,
    DlocalModule,
  ],
  providers: [
    ProviderRegistry,
    CircuitBreakerService,
    RoutingService,
  ],
  exports: [
    ProviderRegistry,
    CircuitBreakerService,
    RoutingService,
  ],
})
export class ProvidersModule {}
