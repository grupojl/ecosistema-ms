// chatia-backend/src/modules/mexus/mexus.module.ts
import { Module } from '@nestjs/common';
import { ProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { MexusController } from '@/modules/mexus/mexus.controller.js';
import { MexusStrategy } from '@/modules/mexus/mexus.strategy.js';

@Module({
  imports:     [ProjectStrategyModule],
  controllers: [MexusController],
  providers: [MexusStrategy],
  exports:   [MexusStrategy],
})
export class MexusModule {}
