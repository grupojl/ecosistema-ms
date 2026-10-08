// notificaciones-backend/src/notifications/dlq/dlq.module.ts
import { join }             from 'path';
import { CHATIA_PROTO_PATH } from '@ecosistema-ms/proto';
import { Module }           from '@nestjs/common';
import { BullModule }       from '@nestjs/bullmq';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUES }           from '@/core/notifications/notifications.constants.js';
import { DlqMonitorService } from '@/queue/dlq/dlq-monitor.service.js';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: QUEUES.DLQ }),
    ClientsModule.registerAsync([
      {
        name: 'CHATIA_GRPC_CLIENT',
        imports: [ConfigModule],
        inject:  [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package:   'chatia',
            protoPath: CHATIA_PROTO_PATH,
            url: config.get<string>('CHATIA_GRPC_URL', 'localhost:5001'),
          },
        }),
      },
    ]),
  ],
  providers: [DlqMonitorService],
  exports:   [DlqMonitorService],
})
export class DlqModule {}
