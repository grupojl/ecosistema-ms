import { NestFactory }        from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe }     from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join }               from 'path';
import { AppModule }          from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package:   'workers',
      protoPath:  join(process.cwd(), 'proto', 'workers.proto'),
      url:        `0.0.0.0:${process.env['GRPC_PORT'] ?? 5005}`,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Workers API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.startAllMicroservices();
  await app.listen(process.env['PORT'] ?? 3004);
}
void bootstrap();
