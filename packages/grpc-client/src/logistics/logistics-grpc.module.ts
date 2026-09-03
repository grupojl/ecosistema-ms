// packages/grpc-client/src/logistics/logistics-grpc.module.ts
import { Module }                   from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LOGISTICS_PROTO_PATH, LOGISTICS_PACKAGE } from '@ecosistema-ms/proto';

export const LOGISTICS_GRPC_CLIENT = 'LOGISTICS_GRPC_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([{
      name: LOGISTICS_GRPC_CLIENT,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package:   LOGISTICS_PACKAGE,
          protoPath: LOGISTICS_PROTO_PATH,
          url:       process.env['LOGISTICS_GRPC_URL'] ?? 'localhost:5006',
          loader:    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
          channelOptions: {
            'grpc.keepalive_time_ms':              30_000,
            'grpc.keepalive_timeout_ms':            5_000,
            'grpc.keepalive_permit_without_calls':      1,
            'grpc.http2.max_pings_without_data':        0,
            'grpc.max_receive_message_length':  4 * 1024 * 1024,
          },
        },
      }),
    }]),
  ],
  exports: [ClientsModule],
})
export class LogisticsGrpcModule {}
