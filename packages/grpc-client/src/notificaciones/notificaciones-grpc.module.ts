// packages/grpc-client/src/notificaciones/notificaciones-grpc.module.ts
import { Module }                   from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NOTIF_PROTO_PATH, NOTIF_PACKAGE } from '@ecosistema-ms/proto';

export const NOTIF_GRPC_CLIENT = 'NOTIF_GRPC_CLIENT';

@Module({
  imports: [
    ClientsModule.registerAsync([{
      name: NOTIF_GRPC_CLIENT,
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package:   NOTIF_PACKAGE,
          protoPath: NOTIF_PROTO_PATH,
          url:       process.env['NOTIF_GRPC_URL'] ?? 'localhost:5003',
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
export class NotificacionesGrpcModule {}
