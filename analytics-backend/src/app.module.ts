// analytics-backend/src/app.module.ts
// Reestructurado por x.sh — arquitectura 10/10
// Un solo import de módulos de negocio: AnalyticsModulesModule
import { createLoggerModule } from '@ecosistema-ms/logger';
import { Module, type NestModule, type MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule }        from '@nestjs/config';
import { BullModule }          from '@nestjs/bullmq';
import { CacheModule }         from '@nestjs/cache-manager';
import { ScheduleModule }      from '@nestjs/schedule';

import { RequestIdMiddleware } from '@/common/middleware/request-id.middleware.js';

// Infraestructura transversal
import { PrismaModule }        from '@/prisma/prisma.module.js';
import { HealthModule }        from '@/health/health.module.js';
import { GrpcModule }          from '@/grpc/grpc.module.js';
import { SseModule }           from '@/sse/sse.module.js';

// Core — procesadores y proyecciones (sin controllers)
import { EventsModule }        from '@/core/events/events.module.js';
import { ProjectionsModule }   from '@/core/projections/projections.module.js';

// Módulos de ecosistema — único lugar con controllers HTTP
import { AnalyticsModulesModule } from '@/modules/index.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    createLoggerModule(),
    ScheduleModule.forRoot(),
    BullModule.forRoot({ connection: { url: REDIS_URL } }),
    CacheModule.register({ isGlobal: true, ttl: 300_000 }),

    // Infraestructura
    PrismaModule,
    HealthModule,
    GrpcModule,
    SseModule,

    // Core sin controllers
    EventsModule,
    ProjectionsModule,

    // Todos los ecosistemas — un solo import
    AnalyticsModulesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
