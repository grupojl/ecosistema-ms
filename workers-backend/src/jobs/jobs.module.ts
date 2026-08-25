// workers-backend/src/jobs/jobs.module.ts
import { join }          from 'path';
import { Module }        from '@nestjs/common';
import { BullModule }    from '@nestjs/bullmq';
import { ConfigModule, ConfigService }   from '@nestjs/config';
import { ClientsModule, Transport }      from '@nestjs/microservices';

import { WORKER_QUEUES, QUEUE_CONFIG }       from './jobs.constants.js';
import { JobsService }                       from './jobs.service.js';
import { JobsController }                    from './jobs.controller.js';
import { EmbeddingService }                  from './services/embedding.service.js';
import { ChunkingService }                   from './services/chunking.service.js';
import { CircuitBreakerService }             from './services/circuit-breaker.service.js';
import { FaqIngestProcessor }                from './processors/faq-ingest.processor.js';
import { VectorIndexProcessor }              from './processors/vector-index.processor.js';
import { CampaignEmailProcessor }            from './processors/campaign-email.processor.js';
import { AnalyticsExportProcessor }          from './processors/analytics-export.processor.js';

const PROTO_DIR = join(process.cwd(), 'proto');
const ANALYTICS_EXPORT_QUEUE = 'workers.analytics-export';

@Module({
  imports: [
    ConfigModule,

    BullModule.registerQueue(
      { name: WORKER_QUEUES.FAQ_INGEST,        defaultJobOptions: QUEUE_CONFIG[WORKER_QUEUES.FAQ_INGEST] },
      { name: WORKER_QUEUES.VECTOR_INDEX,      defaultJobOptions: QUEUE_CONFIG[WORKER_QUEUES.VECTOR_INDEX] },
      { name: WORKER_QUEUES.CAMPAIGN_EMAIL,    defaultJobOptions: QUEUE_CONFIG[WORKER_QUEUES.CAMPAIGN_EMAIL] },
      { name: ANALYTICS_EXPORT_QUEUE },
      { name: WORKER_QUEUES.DLQ_FAQ_INGEST },
      { name: WORKER_QUEUES.DLQ_VECTOR_INDEX },
      { name: WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL },
      { name: 'notify.email' },
    ),

    // gRPC clients registrados aquí para que los processors los puedan inyectar
    ClientsModule.registerAsync([
      {
        name: 'CHATIA_GRPC_CLIENT',
        imports: [ConfigModule],
        inject:  [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package:   'chatia',
            protoPath: join(PROTO_DIR, 'chatia.proto'),
            url: config.get<string>('CHATIA_GRPC_URL', 'localhost:5001'),
          },
        }),
      },
      {
        name: 'NOTIF_GRPC_CLIENT',
        imports: [ConfigModule],
        inject:  [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package:   'notificaciones',
            protoPath: join(PROTO_DIR, 'notificaciones.proto'),
            url: config.get<string>('NOTIF_GRPC_URL', 'localhost:5003'),
          },
        }),
      },
      {
        name: 'ANALYTICS_GRPC_CLIENT',
        imports: [ConfigModule],
        inject:  [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package:   'analytics',
            protoPath: join(PROTO_DIR, 'analytics.proto'),
            url: config.get<string>('ANALYTICS_GRPC_URL', 'localhost:5004'),
          },
        }),
      },
    ]),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    CircuitBreakerService,
    EmbeddingService,
    ChunkingService,
    FaqIngestProcessor,
    VectorIndexProcessor,
    CampaignEmailProcessor,
    AnalyticsExportProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}
