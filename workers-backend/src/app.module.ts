// workers-backend/src/app.module.ts
// Reestructurado por x.sh — arquitectura 10/10
import {
  Module, type NestModule, type MiddlewareConsumer, RequestMethod,
} from '@nestjs/common';
import { ConfigModule }   from '@nestjs/config';
import { BullModule }     from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

// ── Infraestructura ────────────────────────────────────────────────────────
import { PrismaModule }  from '@/infrastructure/prisma/prisma.module.js';
import { MetricsModule } from '@/infrastructure/metrics/metrics.module.js';
import { RequestIdMiddleware } from '@/infrastructure/common/middleware/request-id.middleware.js';

// ── Core ───────────────────────────────────────────────────────────────────
import { CampaignsModule as CoreCampaignsModule } from '@/core/campaigns/campaigns.module.js';
import { JobsModule as CoreJobsModule }            from '@/core/jobs/jobs.module.js';

// ── Queue — processors BullMQ ─────────────────────────────────────────────
import { QueueModule } from '@/queue/queue.module.js';

// ── Entry points HTTP ─────────────────────────────────────────────────────
import { CampaignsModule } from '@/campaigns/campaigns.module.js';
import { JobsModule }      from '@/jobs/jobs.module.js';
import { DlqModule }       from '@/dlq/dlq.module.js';
import { GrpcModule }      from '@/grpc/grpc.module.js';
import { HealthModule }    from '@/health/health.module.js';
import { InternalModule }  from '@/internal/internal.module.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({ connection: { url: REDIS_URL } }),

    // Infraestructura
    PrismaModule,
    MetricsModule,

    // Core
    CoreCampaignsModule,
    CoreJobsModule,

    // Queue
    QueueModule,

    // Entry points
    CampaignsModule,
    JobsModule,
    DlqModule,
    GrpcModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
