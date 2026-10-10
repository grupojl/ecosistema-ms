import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory }                     from '@nestjs/core';
import { ValidationPipe }                  from '@nestjs/common';
import { DocumentBuilder, SwaggerModule }  from '@nestjs/swagger';
import { Logger }                          from 'nestjs-pino';
import { AppModule }                       from '@/app.module.js';
import { ZodExceptionFilter }              from '@ecosistema-ms/auth-server';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  // gRPC: sin servidor todavía (TODO(grpc) en src/grpc/grpc.module.ts) — por ahora HTTP + x-internal-api-key.

  // ZodExceptionFilter desde el inicio — no heredar deuda de class-validator
  app.useGlobalFilters(new ZodExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const swaggerCfg = new DocumentBuilder()
    .setTitle('marketing-backend')
    .setDescription('Ad spend optimization — Meta, Google, TikTok')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-internal-api-key', in: 'header' }, 'internal-api-key')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerCfg));

  const port = process.env['PORT'] ?? '3015';
  await app.listen(port);
  app.get(Logger).log(`HTTP:${port}`, 'marketing-backend');
}

void bootstrap();
