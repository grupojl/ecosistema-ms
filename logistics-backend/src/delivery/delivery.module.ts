import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service.js';
import { PrismaDeliveryRepository } from './repository/prisma-delivery-order.repository.js';
import { DELIVERY_REPOSITORY } from './repository/delivery-order.repository.interface.js';
@Module({
  providers: [DeliveryService, { provide: DELIVERY_REPOSITORY, useClass: PrismaDeliveryRepository }],
  exports: [DeliveryService],
})
export class DeliveryModule {}
