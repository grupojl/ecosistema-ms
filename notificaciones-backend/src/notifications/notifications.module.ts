// notificaciones-backend/src/notifications/notifications.module.ts

import { Module }       from '@nestjs/common';
import { BullModule }   from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { QUEUES, QUEUE_DEFAULTS }    from '@/notifications/notifications.constants.js';
import { NotificationsController }   from '@/notifications/notifications.controller.js';
import { NotificationsService }      from '@/notifications/notifications.service.js';
import { WhatsappAdapter }           from '@/notifications/channels/whatsapp/whatsapp.adapter.js';
import { EmailAdapter }              from '@/notifications/channels/email/email.adapter.js';
import { PushAdapter }               from '@/notifications/channels/push/push.adapter.js';
import {
  WhatsappProcessor,
  EmailProcessor,
  PushProcessor,
}                                    from '@/notifications/processors/notification.processor.js';
import { DlqModule }                 from '@/notifications/dlq/dlq.module.js';

@Module({
  imports: [
    ConfigModule,
    DlqModule,
    BullModule.registerQueue(
      { name: QUEUES.WHATSAPP, defaultJobOptions: QUEUE_DEFAULTS },
      { name: QUEUES.EMAIL,    defaultJobOptions: QUEUE_DEFAULTS },
      { name: QUEUES.PUSH,     defaultJobOptions: QUEUE_DEFAULTS },
    ),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    // Adapters de canal
    WhatsappAdapter,
    EmailAdapter,
    PushAdapter,
    // Processors BullMQ
    WhatsappProcessor,
    EmailProcessor,
    PushProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

// ── ECO-03: MANUAL — agregar al array providers del @Module:
//   import { PrismaNotificationsRepository } from '@/notifications/repository/prisma-notifications.repository.js';
//   import { NOTIFICATIONS_REPOSITORY }      from '@/notifications/repository/notifications.repository.interface.js';
//   providers: [..., PrismaNotificationsRepository, { provide: NOTIFICATIONS_REPOSITORY, useClass: PrismaNotificationsRepository }]
//   exports:   [..., NOTIFICATIONS_REPOSITORY]
