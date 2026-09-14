// workers-backend/src/app.module.ts
import { join }         from 'path';
import { Module }       from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule }   from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { PrismaModule }    from './prisma/prisma.module.js';
import { HealthModule }    from './health/health.module.js';
import { MetricsModule }   from './metrics/metrics.module.js';
import { JobsModule }      from './jobs/jobs.module.js';
import { DlqModule }       from './dlq/dlq.module.js';
import { GrpcModule }      from './grpc/grpc.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';

const PROTO_DIR = join(process.cwd(), 'proto');

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

    ClientsModule.register([
      {
        name:      'CHATIA_GRPC_CLIENT',
        transport: Transport.GRPC,
        options: {
          package:   'chatia',
          protoPath: join(PROTO_DIR, 'chatia.proto'),
          url: process.env['CHATIA_GRPC_URL'] ?? 'localhost:5001',
        },
      },
      {
        name:      'NOTIF_GRPC_CLIENT',
        transport: Transport.GRPC,
        options: {
          package:   'notificaciones',
          protoPath: join(PROTO_DIR, 'notificaciones.proto'),
          url: process.env['NOTIF_GRPC_URL'] ?? 'localhost:5003',
        },
      },
      {
        name:      'ANALYTICS_GRPC_CLIENT',
        transport: Transport.GRPC,
        options: {
          package:   'analytics',
          protoPath: join(PROTO_DIR, 'analytics.proto'),
          url: process.env['ANALYTICS_GRPC_URL'] ?? 'localhost:5004',
        },
      },
    ]),

    PrismaModule,
    MetricsModule,
    HealthModule,
    JobsModule,
    DlqModule,
    GrpcModule,
    CampaignsModule,
  ],
})
export class AppModule {}
