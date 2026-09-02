// pasarelapagos-backend/src/modules/payments/payments.service.ts
//
// Arquitectura: PrismaService + IPaymentsRepository coexisten.
// — IPaymentsRepository para lecturas simples (findById, list, idempotencia).
// — PrismaService directamente para operaciones que requieren $transaction
//   multi-tabla (create con customer.upsert + paymentEvent, refund con Refund).
//   Estas operaciones no pueden abstraerse en el repository sin romper atomicidad.
import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService }    from '../prisma/prisma.service';
import {
  PAYMENTS_REPOSITORY,
  IPaymentsRepository,
} from './repository/payments.repository.interface';
import { ProviderRegistry } from '../providers/provider.registry';
import { AuditService }     from '../audit/audit.service';
import { MetricsService }   from '../metrics/metrics.service';
import type { CreatePaymentInput } from './schemas';
import { assertValidTransition }   from './payment-state.machine';
import type { OrgContext }         from '../../common/interfaces/org-context.interface';
import { PaymentStatus, Prisma }   from '@prisma/client';
import { PaymentMethodKind as PrismaPaymentMethodKind } from '@prisma/client';
import type { PaymentMethodKind as ProviderMethodKind } from '../providers/provider.interface';

// ---------------------------------------------------------------------------
// Mapper: convierte el value lowercase del provider al ENUM de Prisma
// ---------------------------------------------------------------------------
const METHOD_MAP: Record<ProviderMethodKind, PrismaPaymentMethodKind> = {
  card:          PrismaPaymentMethodKind.CARD,
  wallet:        PrismaPaymentMethodKind.WALLET,
  bank_transfer: PrismaPaymentMethodKind.BANK_TRANSFER,
  cash_voucher:  PrismaPaymentMethodKind.CASH_VOUCHER,
  pix:           PrismaPaymentMethodKind.PIX,
  qr:            PrismaPaymentMethodKind.QR,
};

function toPrismaMethod(method: string): PrismaPaymentMethodKind {
  const mapped = METHOD_MAP[method as ProviderMethodKind];
  if (!mapped) throw new BadRequestException(`Método de pago inválido: ${method}`);
  return mapped;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma:   PrismaService,
    @Inject(PAYMENTS_REPOSITORY)
    private readonly paymentsRepo: IPaymentsRepository,
    private readonly registry: ProviderRegistry,
    private readonly audit:    AuditService,
    private readonly metrics:  MetricsService,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------
  async create(
    dto: CreatePaymentInput,
    idempotencyKey: string,
    ctx: OrgContext,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException(
        'Header idempotency-key requerido para crear pagos',
      );
    }

    const orgId = ctx.organizationId;
    const start = Date.now();

    // 1. Idempotencia via repository
    const existing = await this.paymentsRepo.findByIdempotencyKey(idempotencyKey, orgId);
    if (existing) return this.serialize(existing);

    // 2. Routing
    const provider = this.registry.selectFor(dto.country, dto.currency);

    this.logger.log(
      `Pago org=${orgId} provider=${provider.id} ` +
      `${dto.amountMinor} ${dto.currency} ${dto.country}`,
    );

    this.metrics.incrementPending(dto.country);

    const prismaMethod = toPrismaMethod(dto.method);

    // 3. Crear Payment PENDING en DB — necesita $transaction multi-tabla
    const payment = await this.prisma.$transaction(async (tx) => {
      let customerId: string | undefined;

      if (dto.customerId) {
        const customer = await tx.customer.upsert({
          where: {
            tenantId_externalId: {
              tenantId:   orgId,
              externalId: dto.customerId,
            },
          },
          update: {},
          create: {
            tenantId:       orgId,
            organizationId: orgId,
            externalId:     dto.customerId,
            email:          dto.email,
            country:        dto.country,
          } satisfies Prisma.CustomerUncheckedCreateInput,
        });
        customerId = customer.id;
      }

      const p = await tx.payment.create({
        data: {
          tenantId:       orgId,
          organizationId: orgId,
          idempotencyKey,
          amountMinor:    BigInt(dto.amountMinor),
          currency:       dto.currency,
          country:        dto.country,
          method:         prismaMethod,
          status:         PaymentStatus.PENDING,
          providerId:     provider.id,
          description:    dto.description,
          metadata:       dto.metadata as Prisma.InputJsonValue,
          ...(customerId ? { customerId } : {}),
        } satisfies Prisma.PaymentUncheckedCreateInput,
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: p.id,
          type:      'payment.created',
          payload:   { providerId: provider.id, organizationId: orgId } satisfies Prisma.InputJsonValue,
        },
      });

      return p;
    });

    // 4. Llamar provider
    try {
      const result = await provider.createCharge({
        amountMinor:   BigInt(dto.amountMinor),
        currency:      dto.currency,
        country:       dto.country,
        customer:      { id: dto.customerId ?? payment.id, email: dto.email },
        description:   dto.description,
        method:        dto.method as ProviderMethodKind,
        idempotencyKey,
        returnUrl:     dto.returnUrl,
        metadata:      dto.metadata,
      });

      const finalStatus = this.mapProviderStatus(result.status);

      const updated = await this.prisma.$transaction(async (tx) => {
        const p = await tx.payment.update({
          where: { id: payment.id },
          data:  { externalId: result.externalId, status: finalStatus },
        });
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            type:      `provider.${result.status}`,
            payload:   result.raw as Prisma.InputJsonValue,
          },
        });
        return p;
      });

      this.metrics.decrementPending(dto.country);
      this.metrics.recordPayment({
        provider:   provider.id,
        status:     finalStatus,
        country:    dto.country,
        method:     dto.method,
        durationMs: Date.now() - start,
      });

      await this.audit.log({
        tenantId:       orgId,
        organizationId: orgId,
        actorId:        ctx.userId,
        action:         'payment.created',
        resourceId:     updated.id,
        resourceType:   'Payment',
        after:          { status: finalStatus, providerId: provider.id },
      });

      return this.serialize(updated);
    } catch (err) {
      this.metrics.decrementPending(dto.country);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data:  {
          status:         PaymentStatus.FAILED,
          failureCode:    'PROVIDER_ERROR',
          failureMessage: (err as Error).message,
        },
      });
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // LIST — via repository
  // ---------------------------------------------------------------------------
  async findAll(
    ctx: OrgContext,
    query: { status?: PaymentStatus; page?: number; limit?: number },
  ) {
    const result = await this.paymentsRepo.list({
      organizationId: ctx.organizationId,
      tenantId:       ctx.tenantId,
      status:         query.status,
      page:           query.page  ?? 1,
      limit:          query.limit ?? 20,
    });

    return {
      data: result.data.map((p) => this.serialize(p)),
      meta: {
        total: result.total,
        page:  result.page,
        limit: query.limit ?? 20,
        pages: Math.ceil(result.total / (query.limit ?? 20)),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // FIND ONE — via repository
  // ---------------------------------------------------------------------------
  async findOne(id: string, ctx: OrgContext) {
    const payment = await this.paymentsRepo.findById(id, ctx.organizationId);

    if (!payment) {
      throw new NotFoundException(`Payment ${id} no encontrado`);
    }

    return this.serialize(payment);
  }

  // ---------------------------------------------------------------------------
  // REFUND — necesita $transaction multi-tabla
  // ---------------------------------------------------------------------------
  async refund(
    id: string,
    body: { amountMinor?: number; reason?: string },
    ctx: OrgContext,
  ) {
    const payment = await this.paymentsRepo.findById(id, ctx.organizationId);

    if (!payment) {
      throw new NotFoundException(`Payment ${id} no encontrado`);
    }

    if (
      payment.status !== PaymentStatus.CAPTURED &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException(
        `No se puede refundar un pago en estado ${payment.status}`,
      );
    }

    if (!payment.externalId) {
      throw new BadRequestException('El pago no tiene externalId del provider');
    }

    const provider = this.registry.get(payment.providerId);

    const result = await provider.refund({
      externalId:  payment.externalId,
      amountMinor: body.amountMinor ? BigInt(body.amountMinor) : undefined,
      reason:      body.reason,
    });

    const newStatus =
      body.amountMinor && BigInt(body.amountMinor) < payment.amountMinor
        ? PaymentStatus.PARTIALLY_REFUNDED
        : PaymentStatus.REFUNDED;

    assertValidTransition(payment.status, newStatus);

    const [updatedPayment, refund] = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data:  { status: newStatus },
      });

      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type:      'payment.refunded',
          payload:   {
            refundId: result.externalRefundId,
            amount:   body.amountMinor ?? payment.amountMinor.toString(),
            reason:   body.reason,
          } as Prisma.InputJsonValue,
        },
      });

      const r = await tx.refund.create({
        data: {
          paymentId:        payment.id,
          amountMinor:      body.amountMinor
            ? BigInt(body.amountMinor)
            : payment.amountMinor,
          reason:           body.reason,
          externalRefundId: result.externalRefundId,
          status:           'REFUNDED',
        },
      });

      return [p, r] as const;
    });

    await this.audit.log({
      tenantId:       payment.tenantId,
      organizationId: ctx.organizationId,
      actorId:        ctx.userId,
      action:         'payment.refunded',
      resourceId:     payment.id,
      resourceType:   'Payment',
      before:         { status: payment.status },
      after:          { status: newStatus, refundId: refund.id },
    });

    return {
      ...this.serialize(updatedPayment),
      refund: {
        id:               refund.id,
        amountMinor:      refund.amountMinor.toString(),
        externalRefundId: refund.externalRefundId,
        status:           refund.status,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  private serialize(payment: {
    id:              string;
    tenantId:        string;
    amountMinor:     bigint;
    currency:        string;
    country:         string;
    method:          PrismaPaymentMethodKind | string;
    status:          PaymentStatus | string;
    providerId:      string;
    externalId?:     string | null;
    description?:    string | null;
    metadata?:       unknown;
    failureCode?:    string | null;
    failureMessage?: string | null;
    idempotencyKey:  string;
    customerId?:     string | null;
    createdAt:       Date;
    updatedAt:       Date;
    [key: string]:   unknown;
  }) {
    return {
      ...payment,
      amountMinor: payment.amountMinor.toString(),
    };
  }

  private mapProviderStatus(status: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      authorized: PaymentStatus.AUTHORIZED,
      captured:   PaymentStatus.CAPTURED,
      failed:     PaymentStatus.FAILED,
      cancelled:  PaymentStatus.CANCELLED,
      pending:    PaymentStatus.PENDING,
    };
    return map[status] ?? PaymentStatus.PENDING;
  }
}
