// chatia-backend/src/core/strategies/project-strategy.registry.ts
import { Injectable, Logger } from '@nestjs/common';
import { ProjectType, type ProjectStrategy } from './project-strategy.interface.js';

@Injectable()
export class ProjectStrategyRegistry {
  private readonly logger     = new Logger(ProjectStrategyRegistry.name);
  private readonly strategies = new Map<ProjectType, ProjectStrategy>();

  register(strategy: ProjectStrategy): void {
    const type = strategy.getProjectType();
    if (this.strategies.has(type)) {
      this.logger.warn(`Strategy "${type}" ya registrada — sobreescribiendo`);
    }
    this.strategies.set(type, strategy);
    this.logger.log(`Strategy registrada: ${type}`);
  }

  get(ecosystemId: string): ProjectStrategy {
    const strategy = this.strategies.get(ecosystemId as ProjectType);
    if (!strategy) {
      this.logger.warn(`Sin strategy para ecosystemId="${ecosystemId}" — usando GenericStrategy`);
      return this.strategies.get(ProjectType.GENERIC)!; // invariante: siempre registrada en onModuleInit
    }
    return strategy;
  }

  listRegistered(): ProjectType[] {
    return [...this.strategies.keys()];
  }
}
