// chatia-backend/src/modules/manzana/manzana.module.ts
import { Module } from '@nestjs/common';
import { ManzanaStrategy } from '@/modules/manzana/manzana.strategy.js';

@Module({
  providers: [ManzanaStrategy],
  exports:   [ManzanaStrategy],
})
export class ManzanaModule {}
