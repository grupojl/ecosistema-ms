// notificaciones-backend/src/notifications/processors/notification.processor.ts
//
// Processor BullMQ que consume los 3 queues (WHATSAPP | EMAIL | PUSH).
// Un solo processor para los 3 — el switch despacha al adapter correcto.
// Registrado en notifications.module.ts con @Processor() para cada queue.

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger }    from '@nestjs/common';
import type { Job }              from 'bullmq';
import { PrismaService }         from '../../prisma/prisma.service.js';
import { WhatsappAdapter }       from '../channels/whatsapp/whatsapp.adapter.js';
import { EmailAdapter }          from '../channels/email/email.adapter.js';
import { PushAdapter }           from '../channels/push/push.adapter.js';
import type { INotificationChannel, SendPayload } from '../interfaces/notification-channel.interface.js';
import { QUEUES }                from '../notifications.constants.js';

export interface NotificationJobData {
  ecosystemId:    string;
  organizationId: string;
  contactId:      string;
  channel:        'WHATSAPP' | 'EMAIL' | 'PUSH';
  templateKey:    string;
  payload:        Record<string, unknown>;
  idempotencyKey: string;
}

// Tres processors registrados — uno por queue — comparten la lógica de BaseProcessor
abstract class BaseNotificationProcessor extends WorkerHost {
  protected abstract readonly logger: Logger;
  protected abstract readonly adapter: INotificationChannel;
  protected abstract readonly prisma: PrismaService;

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { ecosystemId, organizationId, contactId, channel, templateKey, idempotencyKey, payload } =
      job.data;

    // ── 1. Dedup check ──────────────────────────────────────────────────────
    const existing = await this.prisma.notification.findUnique({
      where: { idempotencyKey },
    });
    if (existing?.status === 'SENT') {
      this.logger.debug(`SKIPPED dedup [${job.id}] key:${idempotencyKey}`);
      return;
    }

    // ── 2. Opt-out check ────────────────────────────────────────────────────
    const pref = await this.prisma.contactPreference.findUnique({
      where: {
        organizationId_contactId_channel: { organizationId, contactId, channel },
      },
    });
    if (pref?.optedOut) {
      await this.upsert(idempotencyKey, ecosystemId, organizationId, contactId, channel, templateKey, payload, 'SKIPPED');
      this.logger.debug(`SKIPPED opt-out [${job.id}] contact:${contactId}`);
      return;
    }

    // ── 3. Upsert PENDING ───────────────────────────────────────────────────
    const notif = await this.upsert(idempotencyKey, ecosystemId, organizationId, contactId, channel, templateKey, payload, 'PENDING');

    // ── 4. Resolve recipient ────────────────────────────────────────────────
    const to = String(payload['to'] ?? payload['phone'] ?? payload['email'] ?? payload['fcmToken'] ?? '');
    if (!to) throw new Error(`Payload sin destinatario para ${channel}`);

    const sendPayload: SendPayload = {
      to,
      body:              String(payload['body'] ?? ''),
      templateKey,
      templateVariables: payload['templateVariables'] as string[] | undefined,
      subject:           payload['subject'] ? String(payload['subject']) : undefined,
      language:          payload['language'] ? String(payload['language']) : undefined,
      meta:              payload['meta'] as Record<string, unknown> | undefined,
    };

    // ── 5. Enviar ───────────────────────────────────────────────────────────
    try {
      await this.adapter.send(sendPayload);
      await this.prisma.notification.update({
        where: { id: notif.id },
        data:  { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
      this.logger.log(`SENT [${job.id}] ${channel} → ${to}`);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.prisma.notification.update({
        where: { id: notif.id },
        data:  { status: 'FAILED', failureReason: reason, attempts: { increment: 1 } },
      });
      throw error; // BullMQ reintentará
    }
  }

  private async upsert(
    idempotencyKey: string,
    ecosystemId:    string,
    organizationId: string,
    contactId:      string,
    channel:        string,
    templateKey:    string,
    payload:        Record<string, unknown>,
    status:         'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED',
  ) {
    return this.prisma.notification.upsert({
      where:  { idempotencyKey },
      update: { status },
      create: { idempotencyKey, ecosystemId, organizationId, contactId, channel: channel as 'WHATSAPP' | 'EMAIL' | 'PUSH', templateKey, payload, status },
    });
  }
}

@Processor(QUEUES.WHATSAPP)
@Injectable()
export class WhatsappProcessor extends BaseNotificationProcessor {
  protected readonly logger  = new Logger(WhatsappProcessor.name);
  constructor(
    protected readonly adapter: WhatsappAdapter,
    protected readonly prisma:  PrismaService,
  ) { super(); }
}

@Processor(QUEUES.EMAIL)
@Injectable()
export class EmailProcessor extends BaseNotificationProcessor {
  protected readonly logger  = new Logger(EmailProcessor.name);
  constructor(
    protected readonly adapter: EmailAdapter,
    protected readonly prisma:  PrismaService,
  ) { super(); }
}

@Processor(QUEUES.PUSH)
@Injectable()
export class PushProcessor extends BaseNotificationProcessor {
  protected readonly logger  = new Logger(PushProcessor.name);
  constructor(
    protected readonly adapter: PushAdapter,
    protected readonly prisma:  PrismaService,
  ) { super(); }
}
