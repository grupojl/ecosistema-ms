// notificaciones-backend/src/app.module.ts
// Reestructurado por x.sh — arquitectura 10/10
import { CommonModule } from '@/infrastructure/common/common.module.js';
import { createLoggerModule } from '@ecosistema-ms/logger';
import {
  Module, type NestModule, type MiddlewareConsumer, RequestMethod,
} from '@nestjs/common';
import { ConfigModule }  from '@nestjs/config';
import { BullModule }    from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

// ── Infraestructura ────────────────────────────────────────────────────────
import { PrismaModule }    from '@/infrastructure/prisma/prisma.module.js';
import { MetricsModule }   from '@/infrastructure/metrics/metrics.module.js';
import { TemplatesModule } from '@/infrastructure/templates/templates.module.js';
import { RequestIdMiddleware } from '@/infrastructure/common/middleware/request-id.middleware.js';

// ── Core ───────────────────────────────────────────────────────────────────
import { NotificationsModule } from '@/core/notifications/notifications.module.js';
import { PreferencesModule }   from '@/core/preferences/preferences.module.js';
import { NotifProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';

// ── Entry points ──────────────────────────────────────────────────────────
import { QueueModule }  from '@/queue/queue.module.js';
import { GrpcModule }   from '@/grpc/grpc.module.js';
import { HealthModule } from '@/health/health.module.js';

// ── Módulos de ecosistema — un solo import ─────────────────────────────────
import { NotificacionesModulesModule } from '@/modules/index.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    createLoggerModule(),
    CommonModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({ connection: { url: REDIS_URL } }),

    // Infraestructura
    PrismaModule,
    MetricsModule,
    TemplatesModule,

    // Core
    NotificationsModule,
    PreferencesModule,
    NotifProjectStrategyModule,

    // Entry points
    QueueModule,
    GrpcModule,
    HealthModule,

    // Todos los ecosistemas — un solo import
    NotificacionesModulesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
