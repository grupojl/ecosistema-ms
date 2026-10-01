// =============================================================================
// core/strategies/project-strategy.module.ts
// Módulo core que provee el registry y la estrategia genérica.
// Los módulos de proyecto (welver, manzana, mexus) se registran
// en sus propios módulos via onModuleInit.
// =============================================================================

import { Module }                   from '@nestjs/common';
import { ProjectStrategyRegistry }  from '@/core/strategies/project-strategy.registry.js';
import { GenericStrategy }          from '@/core/strategies/generic.strategy.js';

@Module({
  providers: [
    ProjectStrategyRegistry,
    GenericStrategy,
  ],
  exports: [
    ProjectStrategyRegistry,
  ],
})
export class ProjectStrategyModule {}
