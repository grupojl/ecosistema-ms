// pasarelapagos-backend/src/internal/internal.controller.ts
//
// Endpoints REST consumidos por grupojl-control (superadmin).
// Norte: Stripe Dashboard → pagos visibles con estado real del provider.
//
// GET  /internal/payments           → listado filtrable con paginación
// GET  /internal/payments/:id       → detalle de un pago
// POST /internal/payments/:id/retry → reintento manual (reason obligatorio)
//
// El AdminAction lo crea superadmin en su propia DB — no este controller.
// Este controller solo ejecuta el reintento en pasarelapagos y devuelve resultado.
import {
  Controller, Get, Post, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { InternalApiKeyGuard }              from '@/internal/internal-api-key.guard.js';
import { PrismaService }                    from '@/modules/prisma/prisma.service.js';
import { ZodValidationPipe }                from '@/common/pipes/zod-validation.pipe.js';
import { z }                                from 'zod';

// ── Schemas ───────────────────────────────────────────────────────────────────

const ListPaymentsSchema = z.object({
  ecosystemId:     z.string().optional(),
  organizationId:  z.string().optional(),
  status:          z.enum(['PENDING','PROCESSING','COMPLETED','FAILED','REFUNDED','CANCELLED']).optional(),
  page:            z.coerce.number().int().positive().default(1),
  limit:           z.coerce.number().int().min(1).max(100).default(50),
});
type ListPaymentsDto = z.infer<typeof ListPaymentsSchema>;

const RetryPaymentSchema = z.object({
  reason: z.string().min(10, 'reason must be at least 10 characters'),
});
type RetryPaymentDto = z.infer<typeof RetryPaymentSchema>;

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('internal')
@ApiHeader({ name: 'x-internal-api-key', required: true })
@UseGuards(InternalApiKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET /internal/payments ────────────────────────────────────────────────
  @Get('payments')
  @ApiOperation({ summary: 'Lista pagos para superadmin — filtrable y paginado' })
  async listPayments(
    @Query(new ZodValidationPipe(ListPaymentsSchema)) dto: ListPaymentsDto,
  ) {
    const { ecosystemId, organizationId, status, page, limit } = dto;
    const skip = (page - 1) * limit;

    const where = {
      ...(ecosystemId    ? { ecosystemId }    : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(status         ? { status }         : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id:             true,
          ecosystemId:    true,
          organizationId: true,
          amount:         true,
          currency:       true,
          status:         true,
          provider:       true,
          createdAt:      true,
          failureReason:  true,
        },
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: data.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  // ── GET /internal/payments/:id ────────────────────────────────────────────
  @Get('payments/:id')
  @ApiOperation({ summary: 'Detalle de un pago para superadmin' })
  async getPayment(@Param('id') id: string) {
    const payment = await this.prisma.payment.findUnique({
      where:  { id },
      select: {
        id:             true,
        ecosystemId:    true,
        organizationId: true,
        amount:         true,
        currency:       true,
        status:         true,
        provider:       true,
        createdAt:      true,
        failureReason:  true,
      },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return { ...payment, createdAt: payment.createdAt.toISOString() };
  }

  // ── POST /internal/payments/:id/retry ────────────────────────────────────
  @Post('payments/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reintento manual de un pago fallido — reason >= 10 chars' })
  async retryPayment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RetryPaymentSchema)) dto: RetryPaymentDto,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id }, select: { id: true, status: true, provider: true },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);

    // Marcar como PENDING para que el procesador lo reintente
    // El PaymentsService real tiene la lógica de reintento por provider
    // Aquí cambiamos el estado — el cron/worker lo procesará
    const updated = await this.prisma.payment.update({
      where:  { id },
      data:   { status: 'PENDING', failureReason: null },
      select: { id: true, status: true },
    });

    return {
      paymentId:   updated.id,
      newStatus:   updated.status,
      retryCount:  1,
      retriedBy:   'superadmin',
      reason:      dto.reason,
    };
  }
}
