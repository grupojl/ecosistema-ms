// Queue: marketing-attribution | Productor: pasarelapagos-backend (fire-forget)
// Norte Northbeam: campaignId nullable = revenue no atribuido (honesto).
// jobId determinista attribution:{paymentId} → un pago, un AttributionEvent.
// Ref: .claude/contracts/marketing-integration.md
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger }                               from '@nestjs/common';
import { Job }                                  from 'bullmq';
import { PrismaService }                        from '../../prisma/prisma.service.js';
import { MARKETING_QUEUES }                     from '../../marketing.constants.js';

export interface AttributeConversionJobData {
  paymentId: string; ecosystemId: string; organizationId: string;
  revenue: string; currency: string; occurredAt: string;
}

@Processor(MARKETING_QUEUES.MARKETING_ATTRIBUTION, { concurrency: 10 })
export class AttributeConversionProcessor extends WorkerHost {
  private readonly logger = new Logger(AttributeConversionProcessor.name);
  constructor(private readonly prisma: PrismaService) { super(); }

  async process(job: Job<AttributeConversionJobData>): Promise<void> {
    const { paymentId, ecosystemId, organizationId, revenue, currency, occurredAt } = job.data;

    // Idempotencia
    const existing = await this.prisma.attributionEvent.findUnique({ where: { paymentId } });
    if (existing) { this.logger.log(`Duplicate attribution ${paymentId} — skipped`); return; }

    // Last-click: campaña activa más reciente de la org
    const lastActive = await this.prisma.campaign.findFirst({
      where: { ecosystemId, organizationId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, platform: true },
    });

    await this.prisma.attributionEvent.create({
      data: {
        paymentId, ecosystemId, organizationId,
        campaignId:      lastActive?.id       ?? null, // null = revenue no atribuido (honesto)
        platform:        lastActive?.platform ?? null,
        revenue:         parseFloat(revenue),
        currency,
        attributionModel: 'LAST_CLICK',
        attributedAt:    new Date(occurredAt),
      },
    });

    lastActive
      ? this.logger.log(`Attributed payment:${paymentId} → campaign:${lastActive.id} revenue:${revenue}`)
      : this.logger.log(`Unattributed revenue payment:${paymentId} — no active campaign`);

    // TODO(fase2): emitir a analytics-backend via analytics-events queue
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AttributeConversionJobData>, err: Error) {
    this.logger.error(`[${job.id}] attribution failed payment:${job.data.paymentId}: ${err.message}`);
  }
}
