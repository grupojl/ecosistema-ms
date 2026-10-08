// pasarelapagos-backend/src/internal/internal.service.ts
// Contrato: .claude/contracts/superadmin-api.md
// Mapeo de columnas (anti-corruption): tenantId = ecosystemId, amountMinor = amount,
// providerId = provider, failureMessage = failureReason.
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { ListPaymentsDto, RetryPaymentDto } from '@/internal/schemas.js';

const PAYMENT_SELECT = {
  id:             true,
  tenantId:       true,
  organizationId: true,
  amountMinor:    true,
  currency:       true,
  status:         true,
  providerId:     true,
  createdAt:      true,
  failureMessage: true,
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

export interface InternalPaymentView {
  id:             string;
  ecosystemId:    string;
  organizationId: string;
  amount:         number;
  currency:       string;
  status:         string;
  provider:       string;
  createdAt:      string;
  failureReason?: string;
}

function toView(p: PaymentRow): InternalPaymentView {
  return {
    id:             p.id,
    ecosystemId:    p.tenantId,
    organizationId: p.organizationId,
    amount:         Number(p.amountMinor),
    currency:       p.currency,
    status:         p.status,
    provider:       p.providerId,
    createdAt:      p.createdAt.toISOString(),
    ...(p.failureMessage ? { failureReason: p.failureMessage } : {}),
  };
}

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listPayments(dto: ListPaymentsDto) {
    const where: Prisma.PaymentWhereInput = {
      ...(dto.ecosystemId    ? { tenantId: dto.ecosystemId }          : {}),
      ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
      ...(dto.status         ? { status: dto.status }                 : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select:  PAYMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip:    (dto.page - 1) * dto.limit,
        take:    dto.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data: rows.map(toView), total, page: dto.page, limit: dto.limit };
  }

  async getPayment(id: string): Promise<InternalPaymentView> {
    const row = await this.prisma.payment.findUnique({ where: { id }, select: PAYMENT_SELECT });
    if (!row) throw new NotFoundException(`Payment ${id} not found`);
    return toView(row);
  }

  async retryPayment(id: string, dto: RetryPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id }, select: { id: true },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);

    // El AdminAction lo crea superadmin antes de llamar este endpoint.
    // Se devuelve a PENDING para que el procesador lo reintente.
    const updated = await this.prisma.payment.update({
      where:  { id },
      data:   { status: 'PENDING', failureCode: null, failureMessage: null },
      select: { id: true, status: true },
    });
    this.logger.log(`[internal] retry solicitado para payment ${id}`);

    return {
      paymentId:  updated.id,
      newStatus:  updated.status,
      retryCount: 1,
      retriedBy:  'superadmin',
      reason:     dto.reason,
    };
  }

  async getHealth() {
    const [pending, failed, captured] = await Promise.all([
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
      this.prisma.payment.count({ where: { status: 'CAPTURED' } }),
    ]);
    return {
      status:   'ok' as const,
      payments: { pending, failed, completed: captured },
      uptime:   Math.floor(process.uptime()),
    };
  }
}
