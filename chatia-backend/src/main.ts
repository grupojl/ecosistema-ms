import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { CHATIA_PROTO_PATH } from '@ecosistema-ms/proto';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import type { Request } from 'express';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { AppModule } from '@/app.module.js';
import { ZodExceptionFilter } from '@ecosistema-ms/auth-server';
import {
  corsFor,
  parseAllowedOrigins,
} from '@/infrastructure/security/cors.js';

async function bootstrap(): Promise<void> {
  // rawBody: necesario para verificar la firma HMAC de los webhooks de Meta/TikTok sobre el cuerpo original
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // ── Pino structured logger ─────────────────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── Detrás del proxy de Railway: req.ip debe ser la IP real del cliente (rate limits) ──
  app.set('trust proxy', 1);

  // ── Cabeceras de seguridad ─────────────────────────────────────────────
  // CORP cross-origin: el snippet del widget se carga desde sitios de terceros
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // ── CORS por ruta: widget público sin credenciales; resto solo ALLOWED_ORIGINS ──
  const allowedOrigins = parseAllowedOrigins(process.env['ALLOWED_ORIGINS']);
  app.enableCors(
    (
      req: Request,
      callback: (err: Error | null, options: CorsOptions) => void,
    ) => {
      const path = req.originalUrl.split('?')[0] ?? '';
      callback(null, corsFor(path, allowedOrigins));
    },
  );

  // ── Cierre ordenado: SIGTERM drena workers de BullMQ, cierra gRPC y Prisma ──
  app.enableShutdownHooks();

  // ── gRPC microservice ──────────────────────────────────────────────────
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'chatia',
      protoPath: CHATIA_PROTO_PATH,
      url: `0.0.0.0:${process.env['GRPC_PORT'] ?? '5010'}`,
      channelOptions: {
        'grpc.keepalive_time_ms': 10_000,
        'grpc.keepalive_timeout_ms': 5_000,
        'grpc.keepalive_permit_without_calls': 1,
        'grpc.http2.max_pings_without_data': 0,
        // UpsertChunks manda vectores de 1024 floats por fragmento: el default (4 MB) se queda corto
        'grpc.max_receive_message_length': 16 * 1024 * 1024,
      },
    },
  });

  // ── Filtros globales — ZodExceptionFilter PRIMERO (ADR-009 / DT-027) ──
  app.useGlobalFilters(new ZodExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger: solo con SWAGGER_ENABLED=true (la validación de env lo prohíbe en producción) ──
  if (process.env['SWAGGER_ENABLED'] === 'true') {
    const swaggerCfg = new DocumentBuilder()
      .setTitle('chatia-backend')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerCfg),
    );
  }

  // ── Arranque ───────────────────────────────────────────────────────────
  await app.startAllMicroservices();
  const port = process.env['PORT'] ?? '3010';
  await app.listen(port);
  app
    .get(Logger)
    .log(
      `HTTP:${port}  gRPC:${process.env['GRPC_PORT'] ?? '5010'}`,
      'chatia-backend',
    );
}

void bootstrap();
