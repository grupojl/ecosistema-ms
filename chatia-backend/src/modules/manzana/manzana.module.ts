// chatia-backend/src/modules/manzana/manzana.module.ts
import { Module } from '@nestjs/common';
import { ManzanaStrategy } from './manzana.strategy.js';

@Module({
  providers: [ManzanaStrategy],
  exports:   [ManzanaStrategy],
})
export class ManzanaModule {}
