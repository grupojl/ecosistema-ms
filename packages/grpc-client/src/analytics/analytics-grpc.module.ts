// packages/grpc-client/src/analytics/analytics-grpc.module.ts
//
// Módulo cliente gRPC para analytics-backend.
// Exporta ANALYTICS_GRPC_CLIENT para inyección en otros servicios.
import { join }                      from 'path';
import { Module }                    from '@nestjs/common';
import { ClientsModule, Transport }  from '@nestjs/microservices';
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
            channelOptions: {
              'grpc.keepalive_time_ms':              30_000,
              'grpc.keepalive_timeout_ms':            5_000,
              'grpc.keepalive_permit_without_calls':      1,
              'grpc.http2.max_pings_without_data':        0,
              'grpc.max_receive_message_length':  4 * 1024 * 1024,
            },
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class AnalyticsGrpcModule {}
