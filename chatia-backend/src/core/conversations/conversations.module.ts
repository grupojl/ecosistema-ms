// chatia-backend/src/conversations/conversations.module.ts
// FASE 4: Repository conectado — ConversationsService inyecta IConversationsRepository
import { Module }              from '@nestjs/common';
import { BullModule }          from '@nestjs/bullmq';
import { ConversationsController }      from '@/core/conversations/conversations.controller.js';
import { ConversationsService }         from '@/core/conversations/conversations.service.js';
import { PrismaConversationsRepository } from '@/core/conversations/repository/prisma-conversations.repository.js';
import { CONVERSATIONS_REPOSITORY }      from '@/core/conversations/repository/conversations.repository.interface.js';
import { LangGraphModule }              from '@/infrastructure/langgraph/langgraph.module.js';
import { ChannelsModule }               from '@/channels/channel.module.js';
import { EventsModule }                 from '@/events/events.module.js';
import { AssignmentModule }             from '@/core/assignment/assignment.module.js';
import { AssistantModule }              from '@/core/assistant/assistant.module.js';
import { NotificationsModule }          from '@/core/notifications/notifications.module.js';
import { AnalyticsEventsModule }        from '@/core/analytics-events/analytics-events.module.js';
import { QUEUES }                       from '@/queue/queue.constants.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.OUTGOING_MESSAGE }),
    LangGraphModule,
    ChannelsModule,
    EventsModule,
    AssignmentModule,
    AssistantModule,
    NotificationsModule,
    AnalyticsEventsModule,
  ],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    PrismaConversationsRepository,
    // Binding: el Service inyecta IConversationsRepository via este token
    {
      provide:  CONVERSATIONS_REPOSITORY,
      useClass: PrismaConversationsRepository,
    },
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
