import { LocationInactiveError, InsufficientStockError } from './location.errors.js';
export function assertLocationActive(isActive: boolean, id: string): void { if (!isActive) throw new LocationInactiveError(id); }
export function assertSufficientStock(available: number, requested: number, variantId: string): void { if (available < requested) throw new InsufficientStockError(variantId, requested, available); }
