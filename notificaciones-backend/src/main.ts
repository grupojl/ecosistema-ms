import 'reflect-metadata';
import { NestFactory }         from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe }      from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger }              from 'nestjs-pino';
import { join }                from 'path';
import { AppModule }           from '@/app.module.js';
import { ZodExceptionFilter }  from '@ecosistema-ms/auth-server';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Pino structured logger ─────────────────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── gRPC microservice ──────────────────────────────────────────────────
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package:   'notificaciones',
      protoPath:  join(process.cwd(), 'proto', 'notificaciones.proto'),
      url:        `0.0.0.0:${process.env['GRPC_PORT'] ?? '5003'}`,
      channelOptions: {
        'grpc.keepalive_time_ms':             10_000,
        'grpc.keepalive_timeout_ms':           5_000,
        'grpc.keepalive_permit_without_calls':     1,
        'grpc.http2.max_pings_without_data':       0,
      },
    },
  });

  // ── Filtros globales — ZodExceptionFilter PRIMERO (ADR-009 / DT-027) ──
  app.useGlobalFilters(new ZodExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,
    forbidNonWhitelisted: true,
    transform:            true,
  }));

  // ── Swagger ────────────────────────────────────────────────────────────
  const swaggerCfg = new DocumentBuilder()
    .setTitle('notificaciones-backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerCfg));

  // ── Arranque ───────────────────────────────────────────────────────────
  await app.startAllMicroservices();
  const port = process.env['PORT'] ?? '3002';
  await app.listen(port);
  app.get(Logger).log(
    `HTTP:${port}  gRPC:5003`,
    'notificaciones-backend',
  );
}

void bootstrap();
