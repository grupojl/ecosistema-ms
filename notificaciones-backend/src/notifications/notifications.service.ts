// notificaciones-backend/src/notifications/notifications.service.ts
// FIX-04: refactorizado para usar INotificationsRepository.
// enqueue() no toca Prisma (solo BullMQ) — se mantiene igual.
// getStatus() y getStats() migrados al repository.
import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue }                                    from '@nestjs/bullmq';
import { Queue }                                          from 'bullmq';
import { QUEUES, QUEUE_DEFAULTS }                         from '@/notifications/notifications.constants.js';
import { buildIdempotencyKey }                            from '@/notifications/dedup/idempotency.helper.js';
import {
  NOTIFICATIONS_REPOSITORY,
  type INotificationsRepository,
  type StatsQuery,
} from '@/notifications/repository/notifications.repository.interface.js';

export interface EnqueueNotificationDto {
  ecosystemId:    string;
  organizationId: string;
  contactId:      string;
  channel:        'WHATSAPP' | 'EMAIL' | 'PUSH';
  templateKey:    string;
  payload:        Record<string, unknown>;
  idempotencyKey?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(QUEUES.WHATSAPP) private readonly waQueue:    Queue,
    @InjectQueue(QUEUES.EMAIL)    private readonly emailQueue:  Queue,
    @InjectQueue(QUEUES.PUSH)     private readonly pushQueue:   Queue,
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly notifRepository: INotificationsRepository,
  ) {}

  // ── Enqueue — sin cambios (no usa Prisma) ────────────────────────────────
  async enqueue(dto: EnqueueNotificationDto): Promise<{ jobId: string; channel: string }> {
    const idempotencyKey = dto.idempotencyKey
      ?? buildIdempotencyKey(dto.ecosystemId, dto.organizationId, dto.contactId, dto.templateKey);

    const queue = this.getQueue(dto.channel);

    const job = await queue.add(
      `notify.${dto.channel.toLowerCase()}`,
      {
        ecosystemId:    dto.ecosystemId,
        organizationId: dto.organizationId,
        contactId:      dto.contactId,
        channel:        dto.channel,
        templateKey:    dto.templateKey,
        payload:        dto.payload,
        idempotencyKey,
      },
      {
        jobId:    idempotencyKey,
        attempts: QUEUE_DEFAULTS.attempts,
        backoff:  QUEUE_DEFAULTS.backoff,
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
      },
    );

    this.logger.log(
      { channel: dto.channel, contactId: dto.contactId, jobId: job.id },
      'notification enqueued',
    );

    return { jobId: job.id as string, channel: dto.channel };
  }

  // ── getStatus — via repository ────────────────────────────────────────────
  async getStatus(id: string) {
    const notif = await this.notifRepository.findById(id);
    if (!notif) throw new NotFoundException(`Notificación ${id} no encontrada`);
    return { success: true, data: notif };
  }

  // ── getStats — via repository ─────────────────────────────────────────────
  async getStats(query: StatsQuery) {
    const stats = await this.notifRepository.getStats(query);
    return { success: true, data: stats };
  }

  // ── Helper privado ────────────────────────────────────────────────────────
  private getQueue(channel: 'WHATSAPP' | 'EMAIL' | 'PUSH'): Queue {
    switch (channel) {
      case 'WHATSAPP': return this.waQueue;
      case 'EMAIL':    return this.emailQueue;
      case 'PUSH':     return this.pushQueue;
    }
  }
}
