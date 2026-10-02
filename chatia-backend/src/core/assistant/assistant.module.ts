// src/assistant/assistant.module.ts
import { Module }                  from '@nestjs/common';
import { BullModule }              from '@nestjs/bullmq';
import { AssistantController }     from '@/assistant/assistant.controller.js';
import { AssistantChatService }    from '@/assistant/chat/assistant-chat.service.js';
import { AssistantConfigService }  from '@/assistant/config/assistant-config.service.js';
import { AssistantSessionService } from '@/assistant/session/assistant-session.service.js';
import { AssistantChatProcessor }  from '@/assistant/processors/assistant-chat.processor.js';
import { GroqModule }              from '@/groq/groq.module.js';
import { EventsModule }            from '@/events/events.module.js';
import { FaqModule }               from '@/faq/faq.module.js';
import { QUEUES }                  from '@/queue/queue.constants.js';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    GroqModule,
    EventsModule,
    FaqModule,
    ...(REDIS_ENABLED ? [
      BullModule.registerQueue({
        name: QUEUES.ASSISTANT_CHAT,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      }),
    ] : []),
  ],
  controllers: [AssistantController],
  providers: [
    AssistantChatService,
    AssistantConfigService,
    AssistantSessionService,
    ...(REDIS_ENABLED ? [AssistantChatProcessor] : []),
  ],
  exports: [AssistantChatService, AssistantConfigService, AssistantSessionService],
})
export class AssistantModule {}
