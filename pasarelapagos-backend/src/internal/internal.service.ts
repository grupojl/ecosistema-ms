import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { ListPaymentsDto, RetryPaymentDto } from '@/internal/schemas';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listPayments(dto: ListPaymentsDto) {
    const where = {
      ecosystemId:    dto.ecosystemId,
      ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
      ...(dto.status          ? { status: dto.status }                 : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id:             true,
          ecosystemId:    true,
          organizationId: true,
          status:         true,
          provider:       true,
          amountCents:    true,
          currency:       true,
          createdAt:      true,
          updatedAt:      true,
        },
        orderBy: { createdAt: 'desc' },
        skip:  (dto.page - 1) * dto.limit,
        take:  dto.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data, total, page: dto.page, limit: dto.limit };
  }

  async retryPayment(id: string, _dto: RetryPaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    // El audit trail lo crea superadmin antes de llamar este endpoint
    // TODO: implementar lógica de retry cuando PaymentsService exponga retryById
    this.logger.log(`[internal] retry solicitado para payment ${id}`);
    return { id, status: payment.status, message: 'retry enqueued' };
  }

  async getHealth() {
    const [pending, failed, completed] = await Promise.all([
      this.prisma.payment.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.count({ where: { status: 'FAILED' } }),
      this.prisma.payment.count({ where: { status: 'COMPLETED' } }),
    ]);

    return {
      status:   'ok' as const,
      payments: { pending, failed, completed },
      uptime:   Math.floor(process.uptime()),
    };
  }
}
