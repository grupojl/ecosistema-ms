// src/infrastructure/queue/processors/outgoing-message.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';
import { ChannelRegistry } from '@/infrastructure/channels/channel.registry.js';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { EventsGateway } from '@/infrastructure/events/events.gateway.js';
import { ChannelType } from '@/generated/prisma/client.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';

export interface OutgoingMessageJobData {
  messageId: string;
  conversationId: string;
  organizationId: string;
  channelType: ChannelType;
  recipientExternalId: string;
  text: string;
  accessToken: string;
  externalId: string; // externalId del ChannelAccount (phone_number_id, page_id, etc.)
  extraConfig: Record<string, unknown>;
  webhookVerifyToken: string;
}

@Processor(QUEUES.OUTGOING_MESSAGE)
export class OutgoingMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(OutgoingMessageProcessor.name);

  constructor(
    private readonly channelRegistry: ChannelRegistry,
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly cipher: TokenCipher,
  ) {
    super();
  }

  async process(job: Job<OutgoingMessageJobData>): Promise<void> {
    const {
      messageId,
      organizationId,
      channelType,
      recipientExternalId,
      text,
      accessToken,
      externalId,
      extraConfig,
      webhookVerifyToken,
    } = job.data;

    this.logger.debug(
      `[job:${job.id}] Enviando mensaje ${messageId} via ${channelType} — intento ${job.attemptsMade + 1}`,
    );

    const channel = this.channelRegistry.get(channelType);

    await channel.sendMessage(
      { to: recipientExternalId, type: 'text', content: text },
      // El job viaja por Redis con el token tal como está en la base (cifrado): se abre recién al enviar
      {
        externalId,
        accessToken: this.cipher.decrypt(accessToken),
        extraConfig,
        webhookVerifyToken,
      },
    );

    // Marcar como SENT si estaba PENDING
    await this.prisma.message.updateMany({
      where: {
        id: messageId,
        status: 'PENDING',
        conversation: { channelAccount: { organizationId } },
      },
      data: { status: 'SENT' },
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<OutgoingMessageJobData>,
    error: Error,
  ): Promise<void> {
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3);

    this.logger.error(
      `[job:${job.id}] Falló intento ${job.attemptsMade}/${job.opts.attempts} — ` +
        `mensaje: ${job.data.messageId} — error: ${error.message}`,
    );

    if (isLastAttempt) {
      // Marcar mensaje como FAILED en DB
      await this.prisma.message.updateMany({
        where: {
          id: job.data.messageId,
          conversation: {
            channelAccount: { organizationId: job.data.organizationId },
          },
        },
        data: { status: 'FAILED' },
      });

      // Notificar al front en tiempo real
      this.events.emitMessageFailed(
        job.data.organizationId,
        job.data.conversationId,
        job.data.messageId,
      );

      this.logger.error(
        `Mensaje ${job.data.messageId} marcado como FAILED tras ${job.attemptsMade} intentos`,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<OutgoingMessageJobData>): void {
    this.logger.debug(
      `[job:${job.id}] Enviado correctamente — mensaje: ${job.data.messageId}`,
    );
  }
}
