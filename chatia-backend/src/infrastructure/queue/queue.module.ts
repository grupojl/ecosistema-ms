// src/infrastructure/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';
import { IncomingMessageProcessor } from '@/infrastructure/queue/processors/incoming-message.processor.js';
import { OutgoingMessageProcessor } from '@/infrastructure/queue/processors/outgoing-message.processor.js';
import { AutoReplyProcessor } from '@/infrastructure/queue/processors/auto-reply.processor.js';
import { ChannelsModule } from '@/infrastructure/channels/channel.module.js';
import { MultimodalModule } from '@/infrastructure/channels/multimodal.module.js';
import { ConversationsModule } from '@/core/conversations/conversations.module.js';
import { EventsModule } from '@/infrastructure/events/events.module.js';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ...(REDIS_ENABLED
      ? [
          BullModule.forRoot({ connection: { url: REDIS_URL } }),
          BullModule.registerQueue(
            {
              name: QUEUES.INCOMING_MESSAGE,
              defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: 100,
                removeOnFail: 200,
              },
            },
            {
              name: QUEUES.OUTGOING_MESSAGE,
              defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: 100,
                removeOnFail: 200,
              },
            },
            {
              name: QUEUES.AUTO_REPLY,
              defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: 100,
                removeOnFail: 200,
              },
            },
          ),
        ]
      : []),
    ChannelsModule,
    MultimodalModule,
    ConversationsModule,
    EventsModule,
  ],
  providers: REDIS_ENABLED
    ? [IncomingMessageProcessor, OutgoingMessageProcessor, AutoReplyProcessor]
    : [],
  exports: REDIS_ENABLED ? [BullModule] : [],
})
export class QueueModule {}
