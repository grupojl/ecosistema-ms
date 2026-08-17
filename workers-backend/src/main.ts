import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { WORKERS_PROTO_PATH, WORKERS_PACKAGE } from "@ecosistema-ms/proto";
import { AppModule } from "./app.module.js";
import helmet from "helmet";
async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.connectMicroservice<MicroserviceOptions>({ transport: Transport.GRPC, options: { package: WORKERS_PACKAGE, protoPath: WORKERS_PROTO_PATH, url: `0.0.0.0:${process.env["GRPC_PORT"] ?? 5005}` } });
  await app.startAllMicroservices();
  await app.listen(process.env["PORT"] ?? 3004);
  logger.log(`HTTP :${process.env["PORT"] ?? 3004} | gRPC :${process.env["GRPC_PORT"] ?? 5005}`);
}
bootstrap();
