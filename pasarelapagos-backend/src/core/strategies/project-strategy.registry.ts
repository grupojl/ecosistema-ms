// pasarelapagos-backend/src/core/strategies/project-strategy.registry.ts
import { Injectable, Logger } from '@nestjs/common';
import { ProjectType, type PaymentProjectStrategy } from './project-strategy.interface.js';

@Injectable()
export class PaymentProjectStrategyRegistry {
  private readonly logger     = new Logger(PaymentProjectStrategyRegistry.name);
  private readonly strategies = new Map<ProjectType, PaymentProjectStrategy>();

  register(strategy: PaymentProjectStrategy): void {
    const type = strategy.getProjectType();
    this.strategies.set(type, strategy);
    this.logger.log(`PaymentStrategy registrada: ${type}`);
  }

  get(ecosystemId: string): PaymentProjectStrategy {
    const strategy = this.strategies.get(ecosystemId as ProjectType);
    if (!strategy) {
      this.logger.warn(`Sin PaymentStrategy para "${ecosystemId}" — usando GenericPaymentStrategy`);
      return this.strategies.get(ProjectType.GENERIC)!; // invariante: siempre registrada en onModuleInit
    }
    return strategy;
  }

  listRegistered(): ProjectType[] { return [...this.strategies.keys()]; }
}
