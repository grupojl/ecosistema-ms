import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { assertLocationActive, assertSufficientStock } from './domain/location.entity.js';
import { DomainError } from './domain/location.errors.js';
import { WAREHOUSE_REPOSITORY, type WarehouseRepository, type LocationRecord, type StockRecord } from './repository/location.repository.interface.js';
@Injectable()
export class WarehouseService {
  constructor(@Inject(WAREHOUSE_REPOSITORY) private readonly repo: WarehouseRepository) {}
  async createLocation(organizationId: string, ecosystemId: string, dto: { name: string; code: string; depot: string; aisle?: string; shelf?: string; capacityUnits: number }): Promise<LocationRecord> { return this.repo.createLocation(organizationId, { ecosystemId, ...dto }); }
  async deactivateLocation(organizationId: string, id: string): Promise<LocationRecord> {
    const loc = await this.repo.findLocationById(organizationId, id);
    if (!loc) throw new NotFoundException(`Location ${id} not found`);
    return this.repo.deactivateLocation(organizationId, id);
  }
  async setStock(organizationId: string, ecosystemId: string, locationId: string, variantId: string, quantity: number): Promise<StockRecord> {
    const loc = await this.repo.findLocationById(organizationId, locationId);
    if (!loc) throw new NotFoundException(`Location ${locationId} not found`);
    try { assertLocationActive(loc.isActive, locationId); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.upsertStock(organizationId, locationId, variantId, ecosystemId, quantity);
  }
  async moveStock(organizationId: string, ecosystemId: string, fromId: string, toId: string, variantId: string, quantity: number): Promise<void> {
    const stock = await this.repo.getStock(organizationId, fromId, variantId);
    if (!stock) throw new NotFoundException(`Stock not found`);
    try { assertSufficientStock(stock.quantity, quantity, variantId); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    await this.repo.moveStock(organizationId, fromId, toId, variantId, ecosystemId, quantity);
  }
  async getStock(organizationId: string, locationId: string, variantId: string): Promise<StockRecord | null> { return this.repo.getStock(organizationId, locationId, variantId); }
}
