import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { NOTIF_PROTO_PATH, NOTIF_PACKAGE } from "@ecosistema-ms/proto";
import { AppModule } from "./app.module.js";
import helmet from "helmet";
async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.enableCors({ origin: (process.env["CORS_ORIGINS"] ?? "").split(",").filter(Boolean), methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"] });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  if (process.env["NODE_ENV"] !== "production") {
    const cfg = new DocumentBuilder().setTitle("notificaciones-backend").setDescription("Despacho multi-canal: WhatsApp, Email, Push").setVersion("1.0").addBearerAuth().build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, cfg));
  }
  app.connectMicroservice<MicroserviceOptions>({ transport: Transport.GRPC, options: { package: NOTIF_PACKAGE, protoPath: NOTIF_PROTO_PATH, url: `0.0.0.0:${process.env["GRPC_PORT"] ?? 5003}` } });
  await app.startAllMicroservices();
  await app.listen(process.env["PORT"] ?? 3002);
  logger.log(`HTTP :${process.env["PORT"] ?? 3002} | gRPC :${process.env["GRPC_PORT"] ?? 5003}`);
}
bootstrap();
