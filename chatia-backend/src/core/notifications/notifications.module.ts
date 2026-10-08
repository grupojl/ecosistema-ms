// src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsService } from '@/core/notifications/notifications.service.js';
import { NotificationsController } from '@/core/notifications/notifications.controller.js';
import { EventsModule } from '@/events/events.module.js';

@Module({
  imports: [EventsModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
