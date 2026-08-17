import { Module }         from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { CHATIA_PROTO_PATH, CHATIA_PACKAGE } from "@ecosistema-ms/proto";

export const CHATIA_GRPC_CLIENT = "CHATIA_GRPC_CLIENT";

/**
 * ChatiaGrpcModule — importar en cualquier microservicio que necesite
 * llamar a chatia-backend via gRPC.
 *
 * URL interna Railway: CHATIA_GRPC_URL (ej: chatia-backend.railway.internal:5001)
 */
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: CHATIA_GRPC_CLIENT,
        useFactory: () => ({
          transport: Transport.GRPC,
          options: {
            url:       process.env["CHATIA_GRPC_URL"] ?? "localhost:5001",
            package:   CHATIA_PACKAGE,
            protoPath: CHATIA_PROTO_PATH,
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class ChatiaGrpcModule {}
