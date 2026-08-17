// packages/grpc-client/src/analytics/analytics-grpc.module.ts
//
// Módulo cliente gRPC para analytics-backend.
// Exporta ANALYTICS_GRPC_CLIENT para inyección en otros servicios.

import { Module }              from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ANALYTICS_PROTO_PATH, ANALYTICS_PACKAGE } from '@ecosistema-ms/proto';

export const ANALYTICS_CLIENT_TOKEN = 'ANALYTICS_GRPC_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name:    ANALYTICS_CLIENT_TOKEN,
        imports: [ConfigModule],
        inject:  [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package:   ANALYTICS_PACKAGE,
            protoPath: ANALYTICS_PROTO_PATH,
            url: config.get<string>('ANALYTICS_GRPC_URL', 'localhost:5004'),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class AnalyticsGrpcModule {}
