// chatia-backend/src/conversations/conversations.module.ts
// FASE 4: Repository conectado — ConversationsService inyecta IConversationsRepository
import { Module }              from '@nestjs/common';
import { BullModule }          from '@nestjs/bullmq';
import { ConversationsController }      from '@/conversations/conversations.controller.js';
import { ConversationsService }         from '@/conversations/conversations.service.js';
import { PrismaConversationsRepository } from '@/conversations/repository/prisma-conversations.repository.js';
import { CONVERSATIONS_REPOSITORY }      from '@/conversations/repository/conversations.repository.interface.js';
import { LangGraphModule }              from '@/langgraph/langgraph.module.js';
import { ChannelsModule }               from '@/channels/channel.module.js';
import { EventsModule }                 from '@/events/events.module.js';
import { AssignmentModule }             from '@/assignment/assignment.module.js';
import { AssistantModule }              from '@/assistant/assistant.module.js';
import { NotificationsModule }          from '@/notifications/notifications.module.js';
import { AnalyticsEventsModule }        from '@/analytics-events/analytics-events.module.js';
import { QUEUES }                       from '@/queue/queue.constants.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.OUTGOING_MESSAGES }),
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
