// notificaciones-backend/src/modules/manzana/manzana.module.ts
// TODO: agregar ManzanaNotifStrategy cuando se integre
import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/core/notifications/notifications.module.js';
import { PreferencesModule } from '@/core/preferences/preferences.module.js';
import { NotifProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { ManzanaController } from '@/modules/manzana/manzana.controller.js';
@Module({
  imports:     [NotifProjectStrategyModule, NotificationsModule, PreferencesModule],
  controllers: [ManzanaController],
})
export class ManzanaNotifModule {}
