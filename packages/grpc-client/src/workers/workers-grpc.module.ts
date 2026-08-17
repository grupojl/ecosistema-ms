import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { WORKERS_PROTO_PATH, WORKERS_PACKAGE } from "@ecosistema-ms/proto";

@Module({
  imports: [
    ClientsModule.registerAsync([{
      name: "WORKERS_PACKAGE",
      useFactory: () => ({
        transport: Transport.GRPC,
        options: {
          package:   WORKERS_PACKAGE,
          protoPath: WORKERS_PROTO_PATH,
          url:       process.env["WORKERS_GRPC_URL"] ?? "localhost:5005",
          loader:    { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true },
        },
      }),
    }]),
  ],
  exports: [ClientsModule],
})
export class WorkersGrpcModule {}
