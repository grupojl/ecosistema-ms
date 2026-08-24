import { join } from 'path';
// packages/grpc-client/src/analytics/analytics-grpc.module.ts
//
// Módulo cliente gRPC para analytics-backend.
// Exporta ANALYTICS_GRPC_CLIENT para inyección en otros servicios.

import { Module }              from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';


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
            package:   'analytics',
            protoPath: join(process.cwd(), 'proto', 'analytics.proto'),
            url: config.get<string>('ANALYTICS_GRPC_URL', 'localhost:5004'),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class AnalyticsGrpcModule {}
