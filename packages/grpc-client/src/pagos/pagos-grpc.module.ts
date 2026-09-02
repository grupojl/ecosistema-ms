// packages/grpc-client/src/pagos/pagos-grpc.module.ts
import { Module }                   from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PAGOS_PROTO_PATH, PAGOS_PACKAGE } from '@ecosistema-ms/proto';

export const PAGOS_GRPC_CLIENT = 'PAGOS_GRPC_CLIENT';

/**
 * PagosGrpcModule — importar en cualquier microservicio que necesite
 * llamar a pasarelapagos-backend via gRPC.
 *
 * URL interna Railway: PAGOS_GRPC_URL (ej: pasarelapagos-backend.railway.internal:5002)
 */
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: PAGOS_GRPC_CLIENT,
        useFactory: () => ({
          transport: Transport.GRPC,
          options: {
            url:       process.env['PAGOS_GRPC_URL'] ?? 'localhost:5002',
            package:   PAGOS_PACKAGE,
            protoPath: PAGOS_PROTO_PATH,
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
export class PagosGrpcModule {}
