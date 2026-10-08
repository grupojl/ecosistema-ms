import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';
// notificaciones-backend/src/notifications/notifications.module.ts

import { Module }       from '@nestjs/common';
import { BullModule }   from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { QUEUES, QUEUE_DEFAULTS }    from '@/core/notifications/notifications.constants.js';
import { NotificationsController }   from '@/core/notifications/notifications.controller.js';
import { NotificationsService }      from '@/core/notifications/notifications.service.js';
import { WhatsappAdapter }           from '@/infrastructure/channels/whatsapp/whatsapp.adapter.js';
import { EmailAdapter }              from '@/infrastructure/channels/email/email.adapter.js';
import { PushAdapter }               from '@/infrastructure/channels/push/push.adapter.js';
import {
  WhatsappProcessor,
  EmailProcessor,
  PushProcessor,
}                                    from '@/queue/notification.processor.js';
import { DlqModule }                 from '@/queue/dlq/dlq.module.js';

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
    CircuitBreakerService,
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
//   import { PrismaNotificationsRepository } from '@/core/notifications/repository/prisma-notifications.repository.js';
//   import { NOTIFICATIONS_REPOSITORY }      from '@/core/notifications/repository/notifications.repository.interface.js';
//   providers: [..., PrismaNotificationsRepository, { provide: NOTIFICATIONS_REPOSITORY, useClass: PrismaNotificationsRepository }]
//   exports:   [..., NOTIFICATIONS_REPOSITORY]
