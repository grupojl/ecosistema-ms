// chatia-backend/src/core/conversations/conversations.module.ts
// FASE 4: Repository conectado — ConversationsService inyecta IConversationsRepository
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConversationsService } from '@/core/conversations/conversations.service.js';
import { LangGraphModule } from '@/infrastructure/langgraph/langgraph.module.js';
import { ChannelsModule } from '@/infrastructure/channels/channel.module.js';
import { EventsModule } from '@/infrastructure/events/events.module.js';
import { AssignmentModule } from '@/core/assignment/assignment.module.js';
import { AssistantModule } from '@/core/assistant/assistant.module.js';
import { NotificationsModule } from '@/core/notifications/notifications.module.js';
import { AnalyticsEventsModule } from '@/core/analytics-events/analytics-events.module.js';
import { AutoReplyService } from '@/core/conversations/auto-reply.service.js';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.OUTGOING_MESSAGE },
      { name: QUEUES.AUTO_REPLY },
    ),
    LangGraphModule,
    ChannelsModule,
    EventsModule,
    AssignmentModule,
    AssistantModule,
    NotificationsModule,
    AnalyticsEventsModule,
  ],
  providers: [ConversationsService, AutoReplyService],
  exports: [ConversationsService, AutoReplyService],
})
export class ConversationsModule {}
