import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { assertValidWeight, assertValidDimensions, assertCanCancel, assertValidTracking, effectiveWeightGrams } from './domain/shipment.entity.js';
import { DomainError } from './domain/shipment.errors.js';
import { SHIPMENT_REPOSITORY, type ShipmentRepository, type ShipmentRecord } from './repository/shipment.repository.interface.js';

@Injectable()
export class ShippingService {
  constructor(@Inject(SHIPMENT_REPOSITORY) private readonly repo: ShipmentRepository) {}

  async create(organizationId: string, ecosystemId: string, dto: {
    orderId?: string; carrier: string; weightGrams: number;
    lengthCm: number; widthCm: number; heightCm: number;
    street: string; city: string; province: string; zipCode: string;
    country?: string; notes?: string;
  }): Promise<ShipmentRecord> {
    try {
      assertValidWeight(dto.weightGrams);
      assertValidDimensions({ lengthCm: dto.lengthCm, widthCm: dto.widthCm, heightCm: dto.heightCm });
    } catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.create(organizationId, { ecosystemId, ...dto });
  }

  async cancel(organizationId: string, id: string): Promise<ShipmentRecord> {
    const s = await this.repo.findById(organizationId, id);
    if (!s) throw new NotFoundException(`Shipment ${id} not found`);
    try { assertCanCancel(s.status); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    return this.repo.updateStatus(organizationId, id, 'CANCELLED', { cancelledAt: new Date() });
  }

  async get(organizationId: string, id: string): Promise<ShipmentRecord> {
    const s = await this.repo.findById(organizationId, id);
    if (!s) throw new NotFoundException(`Shipment ${id} not found`);
    return s;
  }

  async updateTracking(organizationId: string, id: string, tracking: string): Promise<ShipmentRecord> {
    try { assertValidTracking(tracking); }
    catch (e) { if (e instanceof DomainError) throw new UnprocessableEntityException(e.message); throw e; }
    const s = await this.repo.findById(organizationId, id);
    if (!s) throw new NotFoundException(`Shipment ${id} not found`);
    return this.repo.updateStatus(organizationId, id, 'IN_TRANSIT', { trackingNumber: tracking });
  }

  estimateCost(weightGrams: number, dims: { lengthCm: number; widthCm: number; heightCm: number }): number {
    const ew = effectiveWeightGrams(weightGrams, dims);
    return 150000 + Math.ceil(ew / 100) * 5000; // stub — integrar con API de carrier
  }
}
