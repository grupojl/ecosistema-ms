// chatia-backend/src/modules/manzana/manzana.module.ts
import { Module } from '@nestjs/common';
import { ProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { ManzanaController } from '@/modules/manzana/manzana.controller.js';
import { ManzanaStrategy } from '@/modules/manzana/manzana.strategy.js';

@Module({
  imports:     [ProjectStrategyModule],
  controllers: [ManzanaController],
  providers: [ManzanaStrategy],
  exports:   [ManzanaStrategy],
})
export class ManzanaModule {}
