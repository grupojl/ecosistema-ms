// packages/grpc-client/src/workers/workers-grpc.module.ts
import { Module }                   from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WORKERS_PROTO_PATH, WORKERS_PACKAGE } from '@ecosistema-ms/proto';

export const WORKERS_GRPC_CLIENT = 'WORKERS_GRPC_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([{
      name: WORKERS_GRPC_CLIENT,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package:   WORKERS_PACKAGE,
          protoPath: WORKERS_PROTO_PATH,
          url:       process.env['WORKERS_GRPC_URL'] ?? 'localhost:5005',
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
export class WorkersGrpcModule {}
