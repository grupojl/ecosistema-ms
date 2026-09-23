import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ProviderRegistry } from '@/modules/providers/provider.registry';
import { CircuitBreakerService } from '@/modules/providers/circuit-breaker.service';
import { RoutingService } from '@/modules/providers/routing.service';
// Adapters
import { StripeModule } from '@/modules/providers/adapters/stripe/stripe.module';
import { MercadoPagoModule } from '@/modules/providers/adapters/mercadopago/mercadopago.module';
import { PagarmeModule } from '@/modules/providers/adapters/pagarme/pagarme.module';
import { ConektaModule } from '@/modules/providers/adapters/conekta/conekta.module';
import { DlocalModule } from '@/modules/providers/adapters/dlocal/dlocal.module';

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
