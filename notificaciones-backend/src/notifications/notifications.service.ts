// notificaciones-backend/src/notifications/notifications.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue }                           from '@nestjs/bullmq';
import { Queue }                                 from 'bullmq';
import { PrismaService }                         from '../prisma/prisma.service.js';
import { QUEUES, QUEUE_DEFAULTS }                from './notifications.constants.js';
import { buildIdempotencyKey }                   from './dedup/idempotency.helper.js';

export interface EnqueueNotificationDto {
  ecosystemId:    string;
  organizationId: string;
  contactId:      string;
  channel:        'WHATSAPP' | 'EMAIL' | 'PUSH';
  templateKey:    string;
  payload:        Record<string, unknown>;
  idempotencyKey?: string;
}

export interface StatsQuery {
  ecosystemId:    string;
  organizationId: string;
  from:           Date;
  to:             Date;
  channel?:       'WHATSAPP' | 'EMAIL' | 'PUSH';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(QUEUES.WHATSAPP) private readonly waQueue:    Queue,
    @InjectQueue(QUEUES.EMAIL)    private readonly emailQueue:  Queue,
    @InjectQueue(QUEUES.PUSH)     private readonly pushQueue:   Queue,
    private readonly prisma: PrismaService,
  ) {}

  // ── Enqueue ───────────────────────────────────────────────────────────────
  async enqueue(dto: EnqueueNotificationDto): Promise<{ jobId: string; channel: string }> {
    const idempotencyKey = dto.idempotencyKey
      ?? buildIdempotencyKey({
          eventType:      dto.templateKey,
          contactId:      dto.contactId,
          organizationId: dto.organizationId,
        });
    const queue = this.resolveQueue(dto.channel);
    const job   = await queue.add(
      dto.templateKey,
      { ...dto, idempotencyKey },
      {
        ...QUEUE_DEFAULTS,
        jobId: idempotencyKey,
      },
    );
    this.logger.log(`Enqueued ${dto.channel} → ${dto.contactId} [${job.id}]`);
    return { jobId: job.id as string, channel: dto.channel };
  }

  // ── Status ────────────────────────────────────────────────────────────────
  async getStatus(id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException(`Notification ${id} no encontrada`);
    return {
      id:             n.id,
      channel:        n.channel,
      status:         n.status,
      attempts:       n.attempts,
      sentAt:         n.sentAt,
      failureReason:  n.failureReason,
      createdAt:      n.createdAt,
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async getStats(query: StatsQuery) {
    // DT-011 fix: filtrar por ecosystemId además de organizationId
    const where = {
      ecosystemId:    query.ecosystemId,
      organizationId: query.organizationId,
      createdAt:      { gte: query.from, lte: query.to },
      ...(query.channel && { channel: query.channel }),
    };
    const grouped = await this.prisma.notification.groupBy({
      by:    ['channel', 'status'],
      where,
      _count: { _all: true },
    });
    const byChannel: Record<string, {
      total: number; sent: number; failed: number; skipped: number; pending: number;
    }> = {};
    for (const row of grouped) {
      const ch = row.channel as string;
      if (!byChannel[ch]) {
        byChannel[ch] = { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0 };
      }
      const count = row._count._all;
      byChannel[ch]!.total += count;
      const status = (row.status as string).toLowerCase() as keyof typeof byChannel[string];
      if (status in byChannel[ch]!) {
        (byChannel[ch]! as Record<string, number>)[status] = count;
      }
    }
    const stats = Object.entries(byChannel).map(([channel, counts]) => ({
      channel,
      ...counts,
      deliveryRate: counts.total > 0
        ? Math.round((counts.sent / counts.total) * 1_000) / 10
        : 0,
    }));
    return { from: query.from, to: query.to, stats };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private resolveQueue(channel: 'WHATSAPP' | 'EMAIL' | 'PUSH'): Queue {
    switch (channel) {
      case 'WHATSAPP': return this.waQueue;
      case 'EMAIL':    return this.emailQueue;
      case 'PUSH':     return this.pushQueue;
    }
  }
}
