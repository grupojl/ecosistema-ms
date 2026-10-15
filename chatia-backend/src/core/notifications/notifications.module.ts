// src/core/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from '@/core/notifications/notifications.service.js';
import { EventsModule } from '@/infrastructure/events/events.module.js';

@Module({
  imports: [EventsModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
