// src/core/webhooks/webhooks.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksService } from '@/core/webhooks/webhooks.service.js';
import { ConversationsModule } from '@/core/conversations/conversations.module.js';
import { ChannelsModule } from '@/infrastructure/channels/channel.module.js';
import { QueueModule } from '@/infrastructure/queue/queue.module.js';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    ConversationsModule,
    ChannelsModule,
    QueueModule,
    ...(REDIS_ENABLED
      ? [BullModule.registerQueue({ name: QUEUES.INCOMING_MESSAGE })]
      : []),
  ],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
