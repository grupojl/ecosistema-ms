// analytics-backend/src/app.module.ts
import { Module }         from '@nestjs/common';
import { ConfigModule }   from '@nestjs/config';
import { BullModule }     from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule }    from '@nestjs/cache-manager';

import { PrismaModule }    from './prisma/prisma.module.js';
import { HealthModule }    from './health/health.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { GrpcModule }      from './grpc/grpc.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true, ttl: 5 * 60 * 1_000 }),
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
    HealthModule,
    AnalyticsModule,
    GrpcModule,
  ],
})
export class AppModule {}
