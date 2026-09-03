import type { DeliveryStatus } from '../domain/delivery-order.entity.js';
export const DELIVERY_REPOSITORY = 'DELIVERY_REPOSITORY';
export interface DeliveryOrderRecord {
  id: string; ecosystemId: string; organizationId: string; orderId: string | null;
  provider: string; externalId: string | null; status: DeliveryStatus; vehicleType: string;
  originStreet: string; originCity: string; originLat: number | null; originLng: number | null;
  destStreet: string; destCity: string; destLat: number | null; destLng: number | null;
  riderName: string | null; riderPhone: string | null; distanceKm: number | null;
  costCents: number | null; currency: string; notes: string | null;
  createdAt: Date; updatedAt: Date; pickedUpAt: Date | null; deliveredAt: Date | null; cancelledAt: Date | null;
}
export interface CreateDeliveryData {
  ecosystemId: string; orderId?: string; provider: string; vehicleType?: string;
  originStreet: string; originCity: string; originLat?: number; originLng?: number;
  destStreet: string; destCity: string; destLat?: number; destLng?: number; notes?: string;
}
export interface DeliveryRepository {
  findById(organizationId: string, id: string): Promise<DeliveryOrderRecord | null>;
  list(organizationId: string, filter: { status?: DeliveryStatus; limit?: number }): Promise<DeliveryOrderRecord[]>;
  create(organizationId: string, data: CreateDeliveryData): Promise<DeliveryOrderRecord>;
  updateStatus(organizationId: string, id: string, status: DeliveryStatus, extra?: Partial<DeliveryOrderRecord>): Promise<DeliveryOrderRecord>;
}
