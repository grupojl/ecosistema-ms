// pasarelapagos-backend/src/modules/welver/welver.module.ts
import { Module } from '@nestjs/common';
import { WelverPaymentStrategy } from './welver.strategy.js';

@Module({
  providers: [WelverPaymentStrategy],
  exports:   [WelverPaymentStrategy],
})
export class WelverPaymentModule {}
