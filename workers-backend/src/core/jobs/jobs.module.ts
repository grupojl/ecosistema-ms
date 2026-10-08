// workers-backend/src/jobs/jobs.module.ts
import { join, dirname }  from 'path';
import { CHATIA_PROTO_PATH } from '@ecosistema-ms/proto';
import { Module }        from '@nestjs/common';
import { BullModule }    from '@nestjs/bullmq';
import { ConfigModule, ConfigService }   from '@nestjs/config';
import { ClientsModule, Transport }      from '@nestjs/microservices';

import { WORKER_QUEUES, QUEUE_CONFIG }       from '@/core/jobs/jobs.constants.js';
import { JobsService }                       from '@/core/jobs/jobs.service.js';
import { JobsController }                    from '@/jobs/jobs.controller.js';
import { EmbeddingService }                  from '@/infrastructure/common/services/embedding.service.js';
import { ChunkingService }                   from '@/infrastructure/common/services/chunking.service.js';
import { CircuitBreakerService }             from '@/infrastructure/common/services/circuit-breaker.service.js';
import { FaqIngestProcessor }                from '@/queue/processors/faq-ingest.processor.js';
import { VectorIndexProcessor }              from '@/queue/processors/vector-index.processor.js';
import { CampaignEmailProcessor }            from '@/queue/processors/campaign-email.processor.js';
import { AnalyticsExportProcessor }          from '@/queue/processors/analytics-export.processor.js';

const PROTO_DIR = dirname(CHATIA_PROTO_PATH);
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
