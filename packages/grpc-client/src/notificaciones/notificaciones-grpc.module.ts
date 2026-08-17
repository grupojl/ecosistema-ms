import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { NOTIF_PROTO_PATH, NOTIF_PACKAGE } from "@ecosistema-ms/proto";

@Module({
  imports: [
    ClientsModule.registerAsync([{
      name: "NOTIF_PACKAGE",
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package:   NOTIF_PACKAGE,
          protoPath: NOTIF_PROTO_PATH,
          url:       process.env["NOTIF_GRPC_URL"] ?? "localhost:5003",
          loader:    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
        },
      }),
    }]),
  ],
  exports: [ClientsModule],
})
export class NotificacionesGrpcModule {}
