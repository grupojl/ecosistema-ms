// notificaciones-backend/src/modules/welver/welver.module.ts
import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/core/notifications/notifications.module.js';
import { PreferencesModule } from '@/core/preferences/preferences.module.js';
import { NotifProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { WelverController } from '@/modules/welver/welver.controller.js';
import { WelverNotifStrategy } from '@/modules/welver/welver.strategy.js';

@Module({
  imports:     [NotifProjectStrategyModule, NotificationsModule, PreferencesModule],
  controllers: [WelverController],
  providers: [WelverNotifStrategy],
  exports:   [WelverNotifStrategy],
})
export class WelverNotifModule {}
