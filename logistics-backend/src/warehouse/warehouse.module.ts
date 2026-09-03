import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service.js';
import { PrismaWarehouseRepository } from './repository/prisma-location.repository.js';
import { WAREHOUSE_REPOSITORY } from './repository/location.repository.interface.js';
@Module({
  providers: [WarehouseService, { provide: WAREHOUSE_REPOSITORY, useClass: PrismaWarehouseRepository }],
  exports: [WarehouseService],
})
export class WarehouseModule {}
