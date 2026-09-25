// chatia-backend/src/modules/welver/welver.module.ts
import { Module } from '@nestjs/common';
import { WelverStrategy } from './welver.strategy.js';

@Module({
  providers: [WelverStrategy],
  exports:   [WelverStrategy],
})
export class WelverModule {}
