export const WAREHOUSE_REPOSITORY = 'WAREHOUSE_REPOSITORY';
export interface LocationRecord { id: string; ecosystemId: string; organizationId: string; name: string; code: string; depot: string; aisle: string | null; shelf: string | null; capacityUnits: number; isActive: boolean; createdAt: Date; updatedAt: Date; }
export interface StockRecord { id: string; ecosystemId: string; organizationId: string; locationId: string; variantId: string; quantity: number; reserved: number; createdAt: Date; updatedAt: Date; }
export interface WarehouseRepository {
  findLocationById(organizationId: string, id: string): Promise<LocationRecord | null>;
  createLocation(organizationId: string, data: { ecosystemId: string; name: string; code: string; depot: string; aisle?: string; shelf?: string; capacityUnits: number }): Promise<LocationRecord>;
  deactivateLocation(organizationId: string, id: string): Promise<LocationRecord>;
  getStock(organizationId: string, locationId: string, variantId: string): Promise<StockRecord | null>;
  upsertStock(organizationId: string, locationId: string, variantId: string, ecosystemId: string, quantity: number): Promise<StockRecord>;
  moveStock(organizationId: string, fromId: string, toId: string, variantId: string, ecosystemId: string, quantity: number): Promise<void>;
}
