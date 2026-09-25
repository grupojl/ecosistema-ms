// notificaciones-backend/src/core/strategies/project-strategy.module.ts
import { Global, Module, OnModuleInit } from '@nestjs/common';
import { NotifProjectStrategyRegistry } from './project-strategy.registry.js';
import { GenericNotifStrategy }         from './generic.strategy.js';

@Global()
@Module({
  providers: [NotifProjectStrategyRegistry, GenericNotifStrategy],
  exports:   [NotifProjectStrategyRegistry],
})
export class NotifProjectStrategyModule implements OnModuleInit {
  constructor(
    private readonly registry: NotifProjectStrategyRegistry,
    private readonly generic:  GenericNotifStrategy,
  ) {}
  onModuleInit(): void { this.registry.register(this.generic); }
}
