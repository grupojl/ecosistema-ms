import { NotifProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { WelverNotifModule }  from '@/modules/welver/welver.module.js';
import { ManzanaNotifModule } from '@/modules/manzana/manzana.module.js';
import { MexusNotifModule }   from '@/modules/mexus/mexus.module.js';
// notificaciones-backend/src/app.module.ts
import { Module }               from '@nestjs/common';
import { ConfigModule }         from '@nestjs/config';
import { BullModule }           from '@nestjs/bullmq';
import { ScheduleModule }       from '@nestjs/schedule';
import { PrismaModule }         from '@/prisma/prisma.module.js';
import { HealthModule }         from '@/health/health.module.js';
import { NotificationsModule }  from '@/notifications/notifications.module.js';
import { PreferencesModule }    from '@/preferences/preferences.module.js';
import { GrpcModule }           from '@/grpc/grpc.module.js';
import { MetricsModule }        from '@/metrics/metrics.module.js';

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: { level: process.env["LOG_LEVEL"] ?? (process.env["NODE_ENV"] !== "production" ? "debug" : "info"), transport: process.env["NODE_ENV"] !== "production" ? { target: "pino-pretty", options: { colorize: true } } : undefined } }),
    PrometheusModule.register({ path: "/metrics", defaultMetrics: { enabled: true } }),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host:     process.env['REDIS_HOST']     ?? 'localhost',
          port:     parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
          password: process.env['REDIS_PASSWORD'],
        },
      }),
    }),
    PrismaModule,
    // ProjectStrategy org-aware — ADR-019 v2
    NotifProjectStrategyModule,
    WelverNotifModule,
    ManzanaNotifModule,
    MexusNotifModule,
    MetricsModule,
    HealthModule,
    NotificationsModule,
    PreferencesModule,
    GrpcModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
