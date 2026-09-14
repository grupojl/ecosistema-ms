// notificaciones-backend/src/app.module.ts
import { Module }               from '@nestjs/common';
import { ConfigModule }         from '@nestjs/config';
import { BullModule }           from '@nestjs/bullmq';
import { ScheduleModule }       from '@nestjs/schedule';
import { PrismaModule }         from './prisma/prisma.module.js';
import { HealthModule }         from './health/health.module.js';
import { NotificationsModule }  from './notifications/notifications.module.js';
import { PreferencesModule }    from './preferences/preferences.module.js';
import { GrpcModule }           from './grpc/grpc.module.js';
import { MetricsModule }        from './metrics/metrics.module.js';

@Module({
  imports: [
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
    MetricsModule,
    HealthModule,
    NotificationsModule,
    PreferencesModule,
    GrpcModule,
  ],
})
export class AppModule {}
