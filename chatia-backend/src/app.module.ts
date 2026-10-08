// chatia-backend/src/app.module.ts
// Reestructurado por x.sh — arquitectura 10/10
// Un solo import de módulos de negocio: ChatiaModulesModule
import {
  Module, type NestModule, type MiddlewareConsumer, RequestMethod,
} from '@nestjs/common';
import { ConfigModule }    from '@nestjs/config';
import { BullModule }      from '@nestjs/bullmq';
import { CacheModule }     from '@nestjs/cache-manager';
import { ScheduleModule }  from '@nestjs/schedule';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

// ── Infraestructura ────────────────────────────────────────────────────────
import { PrismaModule }    from '@/infrastructure/prisma/prisma.module.js';
import { FirebaseModule }  from '@/infrastructure/firebase/firebase.module.js';
import { GroqModule }      from '@/infrastructure/groq/groq.module.js';
import { LangGraphModule } from '@/infrastructure/langgraph/langgraph.module.js';
import { CommonModule }    from '@/infrastructure/common/common.module.js';
import { RequestIdMiddleware } from '@/infrastructure/common/middleware/request-id.middleware.js';
import { appConfig }       from '@/infrastructure/config/app.config.js';
import { validateEnv }     from '@/infrastructure/config/validation.schema.js';

// ── Core (bounded contexts sin controllers) ────────────────────────────────
import { OrganizationConfigModule } from '@/core/organization-config/organization-config.module.js';
import { EcosystemModule }          from '@/core/ecosystem/ecosystem.module.js';
import { AnalyticsEventsModule }    from '@/core/analytics-events/analytics-events.module.js';

// ── Entry points ──────────────────────────────────────────────────────────
import { WebhooksModule }        from '@/webhooks/webhooks.module.js';
import { WidgetModule }          from '@/widget/widget.module.js';
import { ChannelsModule }        from '@/channels/channel.module.js';
import { QueueModule }           from '@/queue/queue.module.js';
import { EventsModule }          from '@/events/events.module.js';
import { HealthModule }          from '@/health/health.module.js';
import { InternalModule }        from '@/internal/internal.module.js';
import { ChannelAccountsModule } from '@/channel-accounts/channel-accounts.module.js';
import { AgentNotificationsModule } from '@/agent-notifications/agent-notifications.module.js';

// ── Módulos de ecosistema — un solo import ─────────────────────────────────
import { ChatiaModulesModule } from '@/modules/index.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load:     [appConfig],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({ connection: { url: REDIS_URL } }),
    CacheModule.register({ isGlobal: true, ttl: 300_000 }),
    PrometheusModule.register(),

    // Infraestructura
    PrismaModule,
    FirebaseModule,
    GroqModule,
    LangGraphModule,
    CommonModule,

    // Core transversal
    OrganizationConfigModule,
    EcosystemModule,
    AnalyticsEventsModule,

    // Entry points
    WebhooksModule,
    WidgetModule,
    ChannelsModule,
    QueueModule,
    EventsModule,
    HealthModule,
    InternalModule,
    ChannelAccountsModule,
    AgentNotificationsModule,

    // Todos los ecosistemas — un solo import
    ChatiaModulesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
