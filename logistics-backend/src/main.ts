import 'reflect-metadata';
import { NestFactory }       from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger }         from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join }              from 'path';
import { AppModule }         from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import helmet                from 'helmet';

// Validación de env vars al arranque
const REQUIRED_ENV = [
  'DATABASE_URL', 'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`[logistics-backend] Missing required env var: ${key}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app    = await NestFactory.create(AppModule);

  // gRPC microservicio interno
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package:   'logistics',
      protoPath:  join(process.cwd(), 'proto', 'logistics.proto'),
      url:        `0.0.0.0:${process.env['GRPC_PORT'] ?? 5006}`,
    },
  });

  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin:      (process.env['ALLOWED_ORIGINS'] ?? '').split(',').map(s => s.trim()),
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const config = new DocumentBuilder()
    .setTitle('Logistics API')
    .setDescription('Microservicio de logística — Shipping · Delivery · Warehouse')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-organization-id' }, 'x-organization-id')
    .build();
  SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, config));

  await app.startAllMicroservices();
  await app.listen(process.env['PORT'] ?? 3005);
  logger.log(`logistics-backend HTTP :${process.env['PORT'] ?? 3005} | gRPC :${process.env['GRPC_PORT'] ?? 5006}`);
}

void bootstrap();
