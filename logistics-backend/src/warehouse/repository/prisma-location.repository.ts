import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { WarehouseRepository, LocationRecord, StockRecord } from './location.repository.interface.js';
@Injectable()
export class PrismaWarehouseRepository implements WarehouseRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findLocationById(organizationId: string, id: string) { return this.prisma.warehouseLocation.findFirst({ where: { id, organizationId } }); }
  async createLocation(organizationId: string, data: { ecosystemId: string; name: string; code: string; depot: string; aisle?: string; shelf?: string; capacityUnits: number }): Promise<LocationRecord> { return this.prisma.warehouseLocation.create({ data: { organizationId, ...data } }); }
  async deactivateLocation(organizationId: string, id: string): Promise<LocationRecord> { return this.prisma.warehouseLocation.update({ where: { id }, data: { isActive: false } }); }
  async getStock(organizationId: string, locationId: string, variantId: string): Promise<StockRecord | null> { return this.prisma.warehouseStock.findFirst({ where: { organizationId, locationId, variantId } }); }
  async upsertStock(organizationId: string, locationId: string, variantId: string, ecosystemId: string, quantity: number): Promise<StockRecord> {
    return this.prisma.warehouseStock.upsert({
      where: { locationId_variantId: { locationId, variantId } },
      create: { organizationId, ecosystemId, locationId, variantId, quantity },
      update: { quantity },
    });
  }
  async moveStock(organizationId: string, fromId: string, toId: string, variantId: string, ecosystemId: string, quantity: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.warehouseStock.update({ where: { locationId_variantId: { locationId: fromId, variantId } }, data: { quantity: { decrement: quantity } } }),
      this.prisma.warehouseStock.upsert({ where: { locationId_variantId: { locationId: toId, variantId } }, create: { organizationId, ecosystemId, locationId: toId, variantId, quantity }, update: { quantity: { increment: quantity } } }),
    ]);
  }
}
