import 'reflect-metadata';
import { NestFactory }                     from '@nestjs/core';
import { MicroserviceOptions, Transport }  from '@nestjs/microservices';
import { ValidationPipe }                  from '@nestjs/common';
import { DocumentBuilder, SwaggerModule }  from '@nestjs/swagger';
import { Logger }                          from 'nestjs-pino';
import { join }                            from 'path';
import { AppModule }                       from './app.module.js';
import { ZodExceptionFilter }              from '@ecosistema-ms/auth-server';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package:  'marketing',
      protoPath: join(process.cwd(), 'proto', 'marketing.proto'),
      url:       `0.0.0.0:${process.env['GRPC_PORT'] ?? '5006'}`,
      channelOptions: {
        'grpc.keepalive_time_ms':             10_000,
        'grpc.keepalive_timeout_ms':           5_000,
        'grpc.keepalive_permit_without_calls':     1,
        'grpc.http2.max_pings_without_data':       0,
      },
    },
  });

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

  await app.startAllMicroservices();
  const port = process.env['PORT'] ?? '3005';
  await app.listen(port);
  app.get(Logger).log(`HTTP:${port}  gRPC:${process.env['GRPC_PORT'] ?? '5006'}`, 'marketing-backend');
}

void bootstrap();
