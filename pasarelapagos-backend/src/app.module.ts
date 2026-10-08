// pasarelapagos-backend/src/app.module.ts
// Reestructurado por x.sh — arquitectura 10/10
import {
  Module, type NestModule, type MiddlewareConsumer, RequestMethod,
} from '@nestjs/common';
import { ConfigModule }     from '@nestjs/config';
import { BullModule }       from '@nestjs/bullmq';
import { CacheModule }      from '@nestjs/cache-manager';
import { ThrottlerModule }  from '@nestjs/throttler';

// ── Infraestructura ────────────────────────────────────────────────────────
import { PrismaModule }     from '@/infrastructure/prisma/prisma.module.js';
import { FirebaseModule }   from '@/infrastructure/firebase/firebase.module.js';
import { RedisModule }      from '@/infrastructure/redis/redis.module.js';
import { ProvidersModule }  from '@/infrastructure/providers/providers.module.js';
import { AuditModule }      from '@/infrastructure/audit/audit.module.js';
import { MetricsModule }    from '@/infrastructure/metrics/metrics.module.js';
import { PiiModule }        from '@/infrastructure/common/services/pii.module.js';
import { SharedGuardsModule } from '@/infrastructure/common/shared-guards.module.js';
import { RequestIdMiddleware } from '@/infrastructure/common/middleware/request-id.middleware.js';
import { validateEnv }      from '@/infrastructure/config/env.validation.js';

// ── Core ───────────────────────────────────────────────────────────────────
import { PaymentsModule }           from '@/core/payments/payments.module.js';
import { RoutingModule }            from '@/core/routing/routing.module.js';
import { OrganizationConfigModule } from '@/core/organization-config/organization-config.module.js';
import { PaymentProjectStrategyModule }    from '@/core/strategies/project-strategy.module.js';

// ── Entry points ──────────────────────────────────────────────────────────
import { WebhooksModule }  from '@/webhooks/webhooks.module.js';
import { TenantsModule }   from '@/tenants/tenants.module.js';
import { AuthModule }      from '@/auth/auth.module.js';
import { QueueModule }     from '@/queue/queue.module.js';
import { GrpcModule }      from '@/grpc/grpc.module.js';
import { HealthModule }    from '@/health/health.module.js';
import { InternalModule }  from '@/internal/internal.module.js';

// ── Módulos de ecosistema — un solo import ─────────────────────────────────
import { PasarelaModulesModule } from '@/modules/index.js';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    BullModule.forRoot({ connection: { url: REDIS_URL } }),
    CacheModule.register({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),

    // Infraestructura
    PrismaModule,
    FirebaseModule,
    RedisModule,
    ProvidersModule,
    AuditModule,
    MetricsModule,
    PiiModule,
    SharedGuardsModule,

    // Core
    PaymentsModule,
    RoutingModule,
    OrganizationConfigModule,
    PaymentProjectStrategyModule,

    // Entry points
    WebhooksModule,
    TenantsModule,
    AuthModule,
    QueueModule,
    GrpcModule,
    HealthModule,
    InternalModule,

    // Todos los ecosistemas
    PasarelaModulesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
