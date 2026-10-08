// chatia-backend/src/modules/welver/welver.module.ts
import { Module } from '@nestjs/common';
import { ProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { WelverController } from '@/modules/welver/welver.controller.js';
import { WelverStrategy } from '@/modules/welver/welver.strategy.js';

@Module({
  imports:     [ProjectStrategyModule],
  controllers: [WelverController],
  providers: [WelverStrategy],
  exports:   [WelverStrategy],
})
export class WelverModule {}
