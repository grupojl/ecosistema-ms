// Único archivo del módulo que puede importar PrismaService
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ShipmentStatus } from '../domain/shipment.entity.js';
import type { ShipmentRepository, ShipmentRecord, CreateShipmentData } from './shipment.repository.interface.js';

const toRecord = (s: any): ShipmentRecord => ({
  ...s,
  lengthCm: Number(s.lengthCm), widthCm: Number(s.widthCm), heightCm: Number(s.heightCm),
});

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string) {
    const s = await this.prisma.shipment.findFirst({ where: { id, organizationId } });
    return s ? toRecord(s) : null;
  }

  async list(organizationId: string, f: { orderId?: string; status?: ShipmentStatus; limit?: number }) {
    const rows = await this.prisma.shipment.findMany({
      where: { organizationId, ...(f.orderId ? { orderId: f.orderId } : {}), ...(f.status ? { status: f.status as any } : {}) },
      orderBy: { createdAt: 'desc' }, take: f.limit ?? 20,
    });
    return rows.map(toRecord);
  }

  async create(organizationId: string, data: CreateShipmentData) {
    const s = await this.prisma.shipment.create({
      data: { organizationId, ecosystemId: data.ecosystemId, orderId: data.orderId,
        carrier: data.carrier as any, weightGrams: data.weightGrams,
        lengthCm: data.lengthCm, widthCm: data.widthCm, heightCm: data.heightCm,
        street: data.street, city: data.city, province: data.province,
        zipCode: data.zipCode, country: data.country ?? 'AR', notes: data.notes },
    });
    return toRecord(s);
  }

  async updateStatus(organizationId: string, id: string, status: ShipmentStatus, extra: Partial<ShipmentRecord> = {}) {
    const s = await this.prisma.shipment.update({ where: { id }, data: { status: status as any, ...extra } });
    return toRecord(s);
  }
}
