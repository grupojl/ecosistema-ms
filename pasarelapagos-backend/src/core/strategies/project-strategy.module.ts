// pasarelapagos-backend/src/core/strategies/project-strategy.module.ts
import { Global, Module, OnModuleInit } from '@nestjs/common';
import { PaymentProjectStrategyRegistry } from './project-strategy.registry.js';
import { GenericPaymentStrategy }         from './generic.strategy.js';

@Global()
@Module({
  providers: [PaymentProjectStrategyRegistry, GenericPaymentStrategy],
  exports:   [PaymentProjectStrategyRegistry],
})
export class PaymentProjectStrategyModule implements OnModuleInit {
  constructor(
    private readonly registry: PaymentProjectStrategyRegistry,
    private readonly generic:  GenericPaymentStrategy,
  ) {}
  onModuleInit(): void { this.registry.register(this.generic); }
}
