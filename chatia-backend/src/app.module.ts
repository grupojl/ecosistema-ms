// chatia-backend/src/app.module.ts
// Reestructurado por x.sh — arquitectura 10/10
// Un solo import de módulos de negocio: ChatiaModulesModule
import { createLoggerModule } from '@ecosistema-ms/logger';
import {
  Module,
  type NestModule,
  type MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpThrottlerGuard } from '@/infrastructure/security/http-throttler.guard.js';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

// ── Infraestructura ────────────────────────────────────────────────────────
import { GroqModule } from '@/infrastructure/groq/groq.module.js';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module.js';
import { FirebaseModule } from '@/infrastructure/firebase/firebase.module.js';
import { LangGraphModule } from '@/infrastructure/langgraph/langgraph.module.js';
import { CommonModule } from '@/infrastructure/common/common.module.js';
import { SecurityModule } from '@/infrastructure/security/security.module.js';
import { RequestIdMiddleware } from '@/infrastructure/common/middleware/request-id.middleware.js';
import { appConfig } from '@/infrastructure/config/app.config.js';
import { validateEnv } from '@/infrastructure/config/validation.schema.js';

// ── Core (bounded contexts sin controllers) ────────────────────────────────
import { OrganizationConfigModule } from '@/core/organization-config/organization-config.module.js';
import { EcosystemModule } from '@/core/ecosystem/ecosystem.module.js';
import { AnalyticsEventsModule } from '@/core/analytics-events/analytics-events.module.js';

// ── Entry points ──────────────────────────────────────────────────────────
import { ChannelsModule } from '@/infrastructure/channels/channel.module.js';
import { WhatsAppAdminModule } from '@/infrastructure/channels/whatsapp/whatsapp-admin.module.js';
import { QueueModule } from '@/infrastructure/queue/queue.module.js';
import { EventsModule } from '@/infrastructure/events/events.module.js';
import { HealthModule } from '@/infrastructure/transport/health/health.module.js';
import { InternalModule } from '@/infrastructure/transport/internal/internal.module.js';
import { ChatiaServerGrpcModule } from '@/infrastructure/transport/grpc/chatia-grpc.module.js';

// ── API REST del dashboard (antes NO estaban montados: sus endpoints daban 404) ──
import { ContactsModule } from '@/core/contacts/contacts.module.js';
import { ProjectsModule } from '@/core/projects/projects.module.js';
import { AiConfigModule } from '@/core/ai-config/ai-config.module.js';
import { MessagesModule } from '@/core/messages/messages.module.js';
import { DlqModule } from '@/infrastructure/queue/dlq/dlq.module.js';
import { PrivacyModule } from '@/core/privacy/privacy.module.js';

// ── Módulos de ecosistema — un solo import ─────────────────────────────────
import { ChatiaModulesModule } from '@/modules/index.js';

import { bullConnection } from '@/infrastructure/queue/bull-connection.js';

@Module({
  providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateEnv,
    }),
    createLoggerModule(),
    ScheduleModule.forRoot(),
    BullModule.forRoot({ connection: bullConnection() }),
    CacheModule.register({ isGlobal: true, ttl: 300_000 }),
    PrometheusModule.register(),
    // Límite base por IP para toda la API (los endpoints sensibles tienen límites propios más estrictos)
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: Number(process.env['THROTTLE_LIMIT_PER_MIN'] ?? 300),
      },
    ]),

    // Infraestructura
    PrismaModule,
    GroqModule,
    FirebaseModule,
    LangGraphModule,
    CommonModule,
    SecurityModule,

    // Core transversal
    OrganizationConfigModule,
    EcosystemModule,
    AnalyticsEventsModule,

    // Entry points
    ChannelsModule,
    WhatsAppAdminModule,
    QueueModule,
    EventsModule,
    HealthModule,
    InternalModule,
    ChatiaServerGrpcModule,

    // API REST del dashboard
    ContactsModule,
    ProjectsModule,
    AiConfigModule,
    MessagesModule,
    DlqModule,
    PrivacyModule,

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
