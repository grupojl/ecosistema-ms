import { Module }          from '@nestjs/common';
import { ShippingModule }  from '../shipping/shipping.module.js';
import { DeliveryModule }  from '../delivery/delivery.module.js';
import { WarehouseModule } from '../warehouse/warehouse.module.js';
import { LogisticsGrpcController } from './logistics-grpc.controller.js';

@Module({ imports: [ShippingModule, DeliveryModule, WarehouseModule], controllers: [LogisticsGrpcController] })
export class GrpcModule {}
