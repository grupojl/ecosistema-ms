import { DeliveryAlreadyCancelledError, DeliveryAlreadyDeliveredError, MissingOriginError } from './delivery-order.errors.js';
export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'FAILED';
export function assertCanCancelDelivery(status: DeliveryStatus): void {
  if (status === 'DELIVERED') throw new DeliveryAlreadyDeliveredError();
  if (status === 'CANCELLED') throw new DeliveryAlreadyCancelledError();
}
export function assertHasOrigin(street: string): void {
  if (!street?.trim()) throw new MissingOriginError();
}
export function estimateDeliveryCost(distanceKm: number, vehicleType: string): number {
  const base: Record<string, number> = { MOTO: 80000, BICI: 60000, AUTO: 120000, CAMIONETA: 200000 };
  return (base[vehicleType] ?? 80000) + Math.ceil(distanceKm) * 10000; // stub
}
