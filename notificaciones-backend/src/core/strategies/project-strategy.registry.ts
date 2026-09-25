// notificaciones-backend/src/core/strategies/project-strategy.registry.ts
import { Injectable, Logger } from '@nestjs/common';
import { ProjectType, type NotifProjectStrategy } from './project-strategy.interface.js';

@Injectable()
export class NotifProjectStrategyRegistry {
  private readonly logger     = new Logger(NotifProjectStrategyRegistry.name);
  private readonly strategies = new Map<ProjectType, NotifProjectStrategy>();

  register(s: NotifProjectStrategy): void {
    this.strategies.set(s.getProjectType(), s);
    this.logger.log(`NotifStrategy registrada: ${s.getProjectType()}`);
  }

  get(ecosystemId: string): NotifProjectStrategy {
    return this.strategies.get(ecosystemId as ProjectType)
      ?? this.strategies.get(ProjectType.GENERIC)!; // invariante: siempre registrada en onModuleInit
  }

  listRegistered(): ProjectType[] { return [...this.strategies.keys()]; }
}
