import type { ShipmentStatus } from '../domain/shipment.entity.js';

export const SHIPMENT_REPOSITORY = 'SHIPMENT_REPOSITORY';

export interface ShipmentRecord {
  id: string; ecosystemId: string; organizationId: string; orderId: string | null;
  carrier: string; trackingNumber: string | null; status: ShipmentStatus;
  weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  street: string; city: string; province: string; zipCode: string; country: string;
  costCents: number | null; currency: string; labelUrl: string | null; notes: string | null;
  createdAt: Date; updatedAt: Date; cancelledAt: Date | null; deliveredAt: Date | null;
}
export interface CreateShipmentData {
  ecosystemId: string; orderId?: string; carrier: string;
  weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  street: string; city: string; province: string; zipCode: string; country?: string; notes?: string;
}
export interface ShipmentRepository {
  findById(organizationId: string, id: string): Promise<ShipmentRecord | null>;
  list(organizationId: string, filter: { orderId?: string; status?: ShipmentStatus; limit?: number }): Promise<ShipmentRecord[]>;
  create(organizationId: string, data: CreateShipmentData): Promise<ShipmentRecord>;
  updateStatus(organizationId: string, id: string, status: ShipmentStatus, extra?: Partial<ShipmentRecord>): Promise<ShipmentRecord>;
}
