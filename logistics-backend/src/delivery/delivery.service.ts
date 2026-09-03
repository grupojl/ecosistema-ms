import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { assertCanCancelDelivery, assertHasOrigin, estimateDeliveryCost } from './domain/delivery-order.entity.js';
import { DomainError } from './domain/delivery-order.errors.js';
import { DELIVERY_REPOSITORY, type DeliveryRepository, type DeliveryOrderRecord } from './repository/delivery-order.repository.interface.js';
@Injectable()
export class DeliveryService {
  constructor(@Inject(DELIVERY_REPOSITORY) private readonly repo: DeliveryRepository) {}
  async create(organizationId: string, ecosystemId: string, dto: { orderId?: string; provider: string; vehicleType?: string; originStreet: string; originCity: string; originLat?: number; originLng?: number; destStreet: string; destCity: string; destLat?: number; destLng?: number; notes?: string; }): Promise<DeliveryOrderRecord> {
    try { assertHasOrigin(dto.originStreet); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.create(organizationId, { ecosystemId, ...dto });
  }
  async cancel(organizationId: string, id: string): Promise<DeliveryOrderRecord> {
    const d = await this.repo.findById(organizationId, id);
    if (!d) throw new NotFoundException(`DeliveryOrder ${id} not found`);
    try { assertCanCancelDelivery(d.status); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.updateStatus(organizationId, id, 'CANCELLED', { cancelledAt: new Date() });
  }
  async get(organizationId: string, id: string): Promise<DeliveryOrderRecord> {
    const d = await this.repo.findById(organizationId, id);
    if (!d) throw new NotFoundException(`DeliveryOrder ${id} not found`);
    return d;
  }
  estimateCost(distanceKm: number, vehicleType: string): number { return estimateDeliveryCost(distanceKm, vehicleType); }
}
