// pasarelapagos-backend/src/modules/payments/repository/prisma-payments.repository.ts
//
// Adaptador Prisma → entidad de dominio.
// toEntity() mapea campo por campo — TypeScript falla aquí si Prisma cambia el schema.

import { Injectable }  from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  IPaymentsRepository,
  CreatePaymentInput,
  ListPaymentsFilter,
} from './payments.repository.interface.js';
import type { Payment, PaymentStatus, PaymentMethodKind } from '../domain/payment.entity.js';
import type { Payment as PrismaPayment, PaymentStatus as PrismaStatus } from '@prisma/client';

@Injectable()
export class PrismaPaymentsRepository implements IPaymentsRepository {

  constructor(private readonly prisma: PrismaService) {}

  // ── Mapper privado ──────────────────────────────────────────────────────────

  private toEntity(row: PrismaPayment): Payment {
    return {
      id:             row.id,
      tenantId:       row.tenantId,
      organizationId: row.organizationId,
      amountMinor:    row.amountMinor,            // BigInt — ya es el tipo correcto
      currency:       row.currency,
      country:        row.country,
      method:         row.method.toLowerCase()   as PaymentMethodKind,
      status:         row.status                 as PaymentStatus,
      providerId:     row.providerId,
      externalId:     row.externalId,
      description:    row.description,
      // @ecosistema-ms/jsonb-cast — Prisma retorna Json, sabemos que es Record<string,string>
      metadata:       (row.metadata as Record<string, string>) ?? {},
      failureCode:    row.failureCode,
      failureMessage: row.failureMessage,
      idempotencyKey: row.idempotencyKey,
      customerId:     row.customerId,
      createdAt:      row.createdAt,
      updatedAt:      row.updatedAt,
    };
  }

  async findById(id: string, organizationId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findFirst({
      where: { id, organizationId },
    });
    return row ? this.toEntity(row) : null;
  }

  async findByIdempotencyKey(key: string, organizationId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findFirst({
      where: { idempotencyKey: key, organizationId },
    });
    return row ? this.toEntity(row) : null;
  }

  async list(filter: ListPaymentsFilter): Promise<{
    data: Payment[]; total: number; page: number;
  }> {
    const { organizationId, tenantId, status, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      tenantId,
      ...(status ? { status: status as PrismaStatus } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip }),
      this.prisma.payment.count({ where }),
    ]);

    return { data: rows.map((r) => this.toEntity(r)), total, page };
  }

  async create(input: CreatePaymentInput): Promise<Payment> {
    const row = await this.prisma.payment.create({
      data: {
        tenantId:       input.tenantId,
        organizationId: input.organizationId,
        amountMinor:    input.amountMinor,
        currency:       input.currency,
        country:        input.country,
        method:         input.method.toUpperCase() as PrismaStatus, // el enum de Prisma es UPPER
        providerId:     input.providerId,
        idempotencyKey: input.idempotencyKey,
        description:    input.description,
        customerId:     input.customerId,
        metadata:       input.metadata ?? {},
        status:         'PENDING',
      },
    });
    return this.toEntity(row);
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: PaymentStatus,
    extra?: Partial<Pick<Payment, 'externalId' | 'failureCode' | 'failureMessage'>>,
  ): Promise<Payment> {
    const row = await this.prisma.payment.update({
      where: { id },
      data:  { status: status as PrismaStatus, ...extra },
    });
    return this.toEntity(row);
  }
}
