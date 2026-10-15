// src/core/assistant/assistant.module.ts
import { GroqModule } from '@/infrastructure/groq/groq.module.js';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AssistantChatService } from '@/core/assistant/chat/assistant-chat.service.js';
import { AssistantConfigService } from '@/core/assistant/config/assistant-config.service.js';
import { AssistantSessionService } from '@/core/assistant/session/assistant-session.service.js';
import { AssistantChatProcessor } from '@/core/assistant/processors/assistant-chat.processor.js';
import { ProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { EventsModule } from '@/infrastructure/events/events.module.js';
import { FaqModule } from '@/core/faq/faq.module.js';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';

const REDIS_ENABLED = process.env['REDIS_ENABLED'] === 'true';

@Module({
  imports: [
    GroqModule,
    ProjectStrategyModule,
    EventsModule,
    FaqModule,
    ...(REDIS_ENABLED
      ? [
          BullModule.registerQueue({
            name: QUEUES.ASSISTANT_CHAT,
            defaultJobOptions: {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: 100,
              removeOnFail: 200,
            },
          }),
        ]
      : []),
  ],
  providers: [
    AssistantChatService,
    AssistantConfigService,
    AssistantSessionService,
    ...(REDIS_ENABLED ? [AssistantChatProcessor] : []),
  ],
  exports: [
    AssistantChatService,
    AssistantConfigService,
    AssistantSessionService,
  ],
})
export class AssistantModule {}
