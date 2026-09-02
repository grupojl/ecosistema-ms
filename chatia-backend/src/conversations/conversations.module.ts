// chatia-backend/src/conversations/conversations.module.ts
// FASE 4: Repository conectado — ConversationsService inyecta IConversationsRepository
import { Module }              from '@nestjs/common';
import { BullModule }          from '@nestjs/bullmq';
import { ConversationsController }      from './conversations.controller';
import { ConversationsService }         from './conversations.service';
import { PrismaConversationsRepository } from './repository/prisma-conversations.repository';
import { CONVERSATIONS_REPOSITORY }      from './repository/conversations.repository.interface';
import { LangGraphModule }              from '../langgraph/langgraph.module';
import { ChannelsModule }               from '../channels/channel.module';
import { EventsModule }                 from '../events/events.module';
import { AssignmentModule }             from '../assignment/assignment.module';
import { AssistantModule }              from '../assistant/assistant.module';
import { NotificationsModule }          from '../notifications/notifications.module';
import { AnalyticsEventsModule }        from '../analytics-events/analytics-events.module';
import { QUEUES }                       from '../queue/queue.constants';

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
