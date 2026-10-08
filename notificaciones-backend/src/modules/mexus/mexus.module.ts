// notificaciones-backend/src/modules/mexus/mexus.module.ts
// TODO: agregar MexusNotifStrategy cuando se integre
import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/core/notifications/notifications.module.js';
import { PreferencesModule } from '@/core/preferences/preferences.module.js';
import { NotifProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { MexusController } from '@/modules/mexus/mexus.controller.js';
@Module({
  imports:     [NotifProjectStrategyModule, NotificationsModule, PreferencesModule],
  controllers: [MexusController],
})
export class MexusNotifModule {}
