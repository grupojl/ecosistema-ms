// notificaciones-backend/src/notifications/notifications.module.ts

import { Module }       from '@nestjs/common';
import { BullModule }   from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { QUEUES, QUEUE_DEFAULTS }    from './notifications.constants.js';
import { NotificationsController }   from './notifications.controller.js';
import { NotificationsService }      from './notifications.service.js';
import { WhatsappAdapter }           from './channels/whatsapp/whatsapp.adapter.js';
import { EmailAdapter }              from './channels/email/email.adapter.js';
import { PushAdapter }               from './channels/push/push.adapter.js';
import {
  WhatsappProcessor,
  EmailProcessor,
  PushProcessor,
}                                    from './processors/notification.processor.js';
import { DlqModule }                 from './dlq/dlq.module.js';

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
