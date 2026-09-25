// chatia-backend/src/modules/mexus/mexus.module.ts
import { Module } from '@nestjs/common';
import { MexusStrategy } from './mexus.strategy.js';

@Module({
  providers: [MexusStrategy],
  exports:   [MexusStrategy],
})
export class MexusModule {}
