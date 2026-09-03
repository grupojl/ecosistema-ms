import { Module }          from '@nestjs/common';
import { ConfigModule }    from '@nestjs/config';
import { BullModule }      from '@nestjs/bullmq';
import { ScheduleModule }  from '@nestjs/schedule';
import { PrismaModule }    from './prisma/prisma.module.js';
import { HealthModule }    from './health/health.module.js';
import { MetricsModule }   from './metrics/metrics.module.js';
import { ShippingModule }  from './shipping/shipping.module.js';
import { DeliveryModule }  from './delivery/delivery.module.js';
import { WarehouseModule } from './warehouse/warehouse.module.js';
import { GrpcModule }      from './grpc/grpc.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host:     process.env['REDIS_HOST']     ?? 'localhost',
          port:     parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
          password: process.env['REDIS_PASSWORD'],
        },
      }),
    }),
    PrismaModule,
    MetricsModule,
    HealthModule,
    ShippingModule,
    DeliveryModule,
    WarehouseModule,
    GrpcModule,
  ],
})
export class AppModule {}
