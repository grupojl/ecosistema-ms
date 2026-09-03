import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service.js';
import { PrismaShipmentRepository } from './repository/prisma-shipment.repository.js';
import { SHIPMENT_REPOSITORY } from './repository/shipment.repository.interface.js';

@Module({
  providers: [ShippingService, { provide: SHIPMENT_REPOSITORY, useClass: PrismaShipmentRepository }],
  exports: [ShippingService],
})
export class ShippingModule {}
