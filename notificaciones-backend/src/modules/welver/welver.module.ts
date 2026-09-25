// notificaciones-backend/src/modules/welver/welver.module.ts
import { Module } from '@nestjs/common';
import { WelverNotifStrategy } from './welver.strategy.js';

@Module({
  providers: [WelverNotifStrategy],
  exports:   [WelverNotifStrategy],
})
export class WelverNotifModule {}
