// marketing-backend/src/app.module.ts
// Reestructurado por x.sh — arquitectura 10/10
import { createLoggerModule } from '@ecosistema-ms/logger';
import {
  Module, type NestModule, type MiddlewareConsumer, RequestMethod,
} from '@nestjs/common';
import { ConfigModule }   from '@nestjs/config';
import { BullModule }     from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

// ── Infraestructura ────────────────────────────────────────────────────────
import { PrismaModule }    from '@/infrastructure/persistence/prisma.module.js';
import { MetricsModule }   from '@/infrastructure/metrics/metrics.module.js';
import { AdaptersModule }  from '@/infrastructure/adapters/adapters.module.js';
import { RequestIdMiddleware } from '@/infrastructure/common/middleware/request-id.middleware.js';

// ── Core ───────────────────────────────────────────────────────────────────
import { CampaignsModule }   from '@/core/campaigns/campaigns.module.js';
import { AttributionModule } from '@/core/attribution/attribution.module.js';
import { AdAccountsModule as CoreAdAccountsModule } from '@/core/ad-accounts/ad-accounts.module.js';

// ── Queue ──────────────────────────────────────────────────────────────────
import { QueueModule } from '@/queue/queue.module.js';

// ── Entry points ──────────────────────────────────────────────────────────
import { AdAccountsModule } from '@/ad-accounts/ad-accounts.module.js';
import { GrpcModule }       from '@/grpc/grpc.module.js';
import { HealthModule }     from '@/health/health.module.js';
import { InternalModule }   from '@/internal/internal.module.js';

// ── Módulos de ecosistema — un solo import ─────────────────────────────────
import { MarketingModulesModule } from '@/modules/index.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    createLoggerModule(),
    ScheduleModule.forRoot(),
    BullModule.forRoot({ connection: { url: REDIS_URL } }),
    PrismaModule,

    // Infraestructura
    MetricsModule,
    AdaptersModule,

    // Core
    CampaignsModule,
    AttributionModule,
    CoreAdAccountsModule,

    // Queue
    QueueModule,

    // Entry points
    AdAccountsModule,
    GrpcModule,
    HealthModule,
    InternalModule,

    // Todos los ecosistemas — un solo import
    MarketingModulesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
