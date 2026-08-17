// chatia-backend/src/conversations/conversations.module.ts
import { Module }              from '@nestjs/common';
import { BullModule }          from '@nestjs/bullmq';
import { ConversationsController } from './conversations.controller';
import { ConversationsService }    from './conversations.service';
import { LangGraphModule }         from '../langgraph/langgraph.module';
import { ChannelsModule }          from '../channels/channel.module';
import { EventsModule }            from '../events/events.module';
import { AssignmentModule }        from '../assignment/assignment.module';
import { AssistantModule }         from '../assistant/assistant.module';
import { NotificationsModule }     from '../notifications/notifications.module';
import { AnalyticsEventsModule }   from '../analytics-events/analytics-events.module';  // ADR-003
import { QUEUES }                  from '../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.OUTGOING_MESSAGE }),
    LangGraphModule,
    ChannelsModule,
    EventsModule,
    AssignmentModule,
    AssistantModule,
    NotificationsModule,
    AnalyticsEventsModule,   // ADR-003 A-1.4
  ],
  controllers: [ConversationsController],
  providers:   [ConversationsService],
  exports:     [ConversationsService],
})
export class ConversationsModule {}
