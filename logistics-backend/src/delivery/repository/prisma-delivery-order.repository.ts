import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DeliveryStatus } from '../domain/delivery-order.entity.js';
import type { DeliveryRepository, DeliveryOrderRecord, CreateDeliveryData } from './delivery-order.repository.interface.js';
const toRecord = (d: any): DeliveryOrderRecord => ({
  ...d, distanceKm: d.distanceKm ? Number(d.distanceKm) : null,
  originLat: d.originLat ? Number(d.originLat) : null, originLng: d.originLng ? Number(d.originLng) : null,
  destLat: d.destLat ? Number(d.destLat) : null, destLng: d.destLng ? Number(d.destLng) : null,
});
@Injectable()
export class PrismaDeliveryRepository implements DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findById(organizationId: string, id: string) {
    const d = await this.prisma.deliveryOrder.findFirst({ where: { id, organizationId } });
    return d ? toRecord(d) : null;
  }
  async list(organizationId: string, f: { status?: DeliveryStatus; limit?: number }) {
    const rows = await this.prisma.deliveryOrder.findMany({
      where: { organizationId, ...(f.status ? { status: f.status as any } : {}) },
      orderBy: { createdAt: 'desc' }, take: f.limit ?? 20,
    });
    return rows.map(toRecord);
  }
  async create(organizationId: string, data: CreateDeliveryData) {
    const d = await this.prisma.deliveryOrder.create({
      data: { organizationId, ecosystemId: data.ecosystemId, orderId: data.orderId,
        provider: data.provider as any, vehicleType: (data.vehicleType ?? 'MOTO') as any,
        originStreet: data.originStreet, originCity: data.originCity,
        originLat: data.originLat, originLng: data.originLng,
        destStreet: data.destStreet, destCity: data.destCity,
        destLat: data.destLat, destLng: data.destLng, notes: data.notes },
    });
    return toRecord(d);
  }
  async updateStatus(organizationId: string, id: string, status: DeliveryStatus, extra: Partial<DeliveryOrderRecord> = {}) {
    const d = await this.prisma.deliveryOrder.update({ where: { id }, data: { status: status as any, ...extra } });
    return toRecord(d);
  }
}
