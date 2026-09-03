// Funciones puras — 0 side effects, 0 imports de infraestructura
import {
  InvalidWeightError, InvalidDimensionsError,
  ShipmentAlreadyCancelledError, ShipmentAlreadyDeliveredError,
  InvalidTrackingNumberError,
} from './shipment.errors.js';

export type ShipmentStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

export interface ShipmentDimensions { lengthCm: number; widthCm: number; heightCm: number; }

export function assertValidWeight(g: number): void {
  if (g <= 0) throw new InvalidWeightError(g);
}
export function assertValidDimensions(d: ShipmentDimensions): void {
  if (d.lengthCm <= 0) throw new InvalidDimensionsError('lengthCm', d.lengthCm);
  if (d.widthCm  <= 0) throw new InvalidDimensionsError('widthCm',  d.widthCm);
  if (d.heightCm <= 0) throw new InvalidDimensionsError('heightCm', d.heightCm);
}
export function assertCanCancel(status: ShipmentStatus): void {
  if (status === 'DELIVERED') throw new ShipmentAlreadyDeliveredError();
  if (status === 'CANCELLED') throw new ShipmentAlreadyCancelledError();
}
export function assertValidTracking(t: string): void {
  if (!t || t.trim().length < 4) throw new InvalidTrackingNumberError(t);
}
export function volumetricWeightGrams(d: ShipmentDimensions): number {
  return Math.ceil((d.lengthCm * d.widthCm * d.heightCm) / 5);
}
export function effectiveWeightGrams(actual: number, d: ShipmentDimensions): number {
  return Math.max(actual, volumetricWeightGrams(d));
}
