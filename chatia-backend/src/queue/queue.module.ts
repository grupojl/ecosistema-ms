// src/queue/queue.module.ts
import { Module }     from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES }     from '@/queue/queue.constants.js';
import { IncomingMessageProcessor } from '@/queue/processors/incoming-message.processor.js';
import { OutgoingMessageProcessor } from '@/queue/processors/outgoing-message.processor.js';
import { ChannelsModule }      from '@/channels/channel.module.js';
import { ConversationsModule } from '@/conversations/conversations.module.js';
import { EventsModule }        from '@/events/events.module.js';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';
const REDIS_URL     = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ...(REDIS_ENABLED ? [
      BullModule.forRoot({ connection: { url: REDIS_URL } }),
      BullModule.registerQueue(
        { name: QUEUES.INCOMING_MESSAGE, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 200 } },
        { name: QUEUES.OUTGOING_MESSAGE, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 200 } },
      ),
    ] : []),
    ChannelsModule,
    ConversationsModule,
    EventsModule,
  ],
  providers: REDIS_ENABLED ? [IncomingMessageProcessor, OutgoingMessageProcessor] : [],
  exports:   REDIS_ENABLED ? [BullModule] : [],
})
export class QueueModule {}
