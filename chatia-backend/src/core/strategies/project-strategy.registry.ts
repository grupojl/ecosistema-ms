// chatia-backend/src/core/strategies/project-strategy.registry.ts
import { Injectable, Logger } from '@nestjs/common';
import { ProjectType, type ProjectStrategy } from '@/core/strategies/project-strategy.interface.js';

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

  /**
   * Resuelve la strategy por tipo de proyecto (Ecosystem.config.projectType).
   * Sin tipo o con un tipo no registrado cae a GenericStrategy.
   */
  get(ecosystemId: string, projectType?: string | null): ProjectStrategy {
    const strategy = projectType ? this.strategies.get(projectType as ProjectType) : undefined;
    if (!strategy) {
      if (projectType) {
        this.logger.warn(`projectType="${projectType}" sin strategy (ecosystemId="${ecosystemId}") — usando GenericStrategy`);
      }
      return this.strategies.get(ProjectType.GENERIC)!; // invariante: GenericStrategy se registra en onModuleInit
    }
    return strategy;
  }

  listRegistered(): ProjectType[] {
    return [...this.strategies.keys()];
  }
}
