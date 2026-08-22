// chatia-backend/src/app.module.ts
import { Module }           from '@nestjs/common';
import { ConfigModule }     from '@nestjs/config';
import { BullModule }       from '@nestjs/bullmq';


// Analytics events — ADR-003 A-1.4
import { AnalyticsEventsModule } from './analytics-events/analytics-events.module.js';
// Analytics proxy deprecated (eliminar en semana 6 cuando welver migre)
import { AnalyticsModule }       from './analytics/analytics.module.js';

// Core modules
import { PrismaModule }         from './prisma/prisma.module.js';
import { HealthModule }         from './health/health.module.js';
import { CommonModule }         from './common/common.module.js';
import { FirebaseModule }       from './firebase/firebase.module.js';
import { GroqModule }           from './groq/groq.module.js';
import { EventsModule }         from './events/events.module.js';

// Business modules
import { EcosystemModule }      from './ecosystem/ecosystem.module.js';
import { OrganizationsModule }  from './organizations/organizations.module.js';
import { AgentsModule }         from './agents/agents.module.js';
import { ContactsModule }       from './contacts/contacts.module.js';
import { ConversationsModule }  from './conversations/conversations.module.js';
import { MessagesModule }       from './messages/messages.module.js';
import { ChannelsModule }        from './channels/channel.module.js';
import { ChannelAccountsModule } from './channel-accounts/channel-accounts.module.js';
import { AssistantModule }      from './assistant/assistant.module.js';
import { FaqModule }            from './faq/faq.module.js';
import { WebhooksModule }       from './webhooks/webhooks.module.js';
import { NotificationsModule }  from './notifications/notifications.module.js';
import { WidgetModule }         from './widget/widget.module.js';
import { InternalModule }       from './internal/internal.module.js';
import { QueueModule }          from './queue/queue.module.js';
import { AiConfigModule }       from './ai-config/ai-config.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host:     process.env['REDIS_HOST']     ?? 'localhost',
          port:     parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
          password: process.env['REDIS_PASSWORD'],
        },
      }),
    }),

    // Infraestructura
    PrismaModule,
    FirebaseModule,
    CommonModule,
    GroqModule,
    EventsModule,
    QueueModule,

    // Analytics — ADR-003
    AnalyticsEventsModule,   // producer de eventos hacia analytics-backend
    AnalyticsModule,         // proxy deprecated → eliminar cuando welver migre

    // Negocio
    HealthModule,
    EcosystemModule,
    OrganizationsModule,
    AgentsModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    ChannelsModule,
    ChannelAccountsModule,
    AssistantModule,
    FaqModule,
    WebhooksModule,
    NotificationsModule,
    WidgetModule,
    InternalModule,
    AiConfigModule,
  ],
})
export class AppModule {}
