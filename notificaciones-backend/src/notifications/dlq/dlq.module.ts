// notificaciones-backend/src/notifications/dlq/dlq.module.ts

import { Module }           from '@nestjs/common';
import { BullModule }       from '@nestjs/bullmq';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CHATIA_PROTO_PATH, CHATIA_PACKAGE } from '@ecosistema-ms/proto';
import { QUEUES }           from '../notifications.constants.js';
import { DlqMonitorService } from './dlq-monitor.service.js';

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
            package:   CHATIA_PACKAGE,
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
