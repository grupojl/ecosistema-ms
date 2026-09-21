// marketing-backend/src/app.module.ts
import { Module }           from '@nestjs/common';
import { ConfigModule }     from '@nestjs/config';
import { BullModule }       from '@nestjs/bullmq';
import { ScheduleModule }   from '@nestjs/schedule';
import { LoggerModule }     from 'nestjs-pino';
import { PrometheusModule } from '@nestjs-modules/nestjs-prometheus';

import { PrismaModule }      from './prisma/prisma.module.js';
import { HealthModule }      from './health/health.module.js';
import { MetricsModule }     from './metrics/metrics.module.js';
import { InternalModule }    from './internal/internal.module.js';
import { AdAccountsModule }  from './ad-accounts/ad-accounts.module.js';
import { CampaignsModule }   from './campaigns/campaigns.module.js';
import { AttributionModule } from './attribution/attribution.module.js';
import { GrpcModule }        from './grpc/grpc.module.js';
import { MARKETING_QUEUES }  from './marketing.constants.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info'),
        transport: process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      },
    }),
    PrometheusModule.register({ path: '/metrics', defaultMetrics: { enabled: true } }),
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
    // CRÍTICO: mismo Redis que pasarelapagos-backend para marketing-attribution
    BullModule.registerQueue(
      { name: MARKETING_QUEUES.CAMPAIGN_SYNC },
      { name: MARKETING_QUEUES.CAMPAIGN_AUTOMATION },
      { name: MARKETING_QUEUES.MARKETING_ATTRIBUTION },
      { name: MARKETING_QUEUES.DLQ },
    ),
    PrismaModule,
    HealthModule,
    MetricsModule,
    InternalModule,
    AdAccountsModule,
    CampaignsModule,
    AttributionModule,
    GrpcModule,
  ],
})
export class AppModule {}
