import { PaymentProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { PaymentOrgConfigService, REDIS_CLIENT } from '@/organization-config/organization-config.service.js';
import { WelverPaymentModule }  from '@/modules/welver/welver.module.js';
import { ManzanaPaymentModule } from '@/modules/manzana/manzana.module.js';
import { MexusPaymentModule }   from '@/modules/mexus/mexus.module.js';
// src/app.module.ts
import { Module, type NestModule, type MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { RequestIdMiddleware } from '@/common/middleware/request-id.middleware.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { envSchema } from '@/config/env.validation';

// Core
import { InternalModule } from '@/internal/internal.module.js';
import { PrismaModule }   from '@/modules/prisma/prisma.module';
import { FirebaseModule }    from '@/modules/firebase/firebase.module';
import { SharedGuardsModule } from '@/common/shared-guards.module';
import { RedisModule }    from '@/modules/redis/redis.module';
import { QueueModule }    from '@/modules/queue/queue.module';
import { AuditModule }    from '@/modules/audit/audit.module';
import { MetricsModule }  from '@/modules/metrics/metrics.module';

// Business
    // ProjectStrategy org-aware — ADR-019 v2
    PaymentProjectStrategyModule,
    { provide: 'PAYMENT_ORG_CONFIG_SVC', useClass: PaymentOrgConfigService },
    WelverPaymentModule,
    ManzanaPaymentModule,
    MexusPaymentModule,
import { AuthModule }      from '@/modules/auth/auth.module';
import { PaymentsModule }  from '@/modules/payments/payments.module';
import { WebhooksModule }  from '@/modules/webhooks/webhooks.module';
import { TenantsModule }   from '@/modules/tenants/tenants.module';
import { ProvidersModule } from '@/modules/providers/providers.module';
import { HealthModule }    from '@/modules/health/health.module';

// Guards globales
import { TenantThrottlerGuard } from '@/common/guards/tenant-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          throw new Error(
            `Variables de entorno inválidas:\n${result.error.toString()}`,
          );
        }
        return result.data;
      },
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level:     config.get<string>('LOG_LEVEL') ?? 'info',
          transport: config.get<string>('NODE_ENV') !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
          redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
        },
      }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{
          ttl:   config.get<number>('THROTTLE_TTL')   ?? 60,
          limit: config.get<number>('THROTTLE_LIMIT') ?? 200,
        }],
      }),
    }),

    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    // Core
    InternalModule,
    PrismaModule,
    FirebaseModule,
    SharedGuardsModule,
    RedisModule,
    QueueModule,
    AuditModule,
    MetricsModule,

    // Business
    // ProjectStrategy org-aware — ADR-019 v2
    PaymentProjectStrategyModule,
    { provide: 'PAYMENT_ORG_CONFIG_SVC', useClass: PaymentOrgConfigService },
    WelverPaymentModule,
    ManzanaPaymentModule,
    MexusPaymentModule,
    AuthModule,
    PaymentsModule,
    WebhooksModule,
    TenantsModule,
    ProvidersModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: TenantThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
