// src/infrastructure/queue/processors/incoming-message.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';
import { ConversationsService } from '@/core/conversations/conversations.service.js';
import { MultimodalService } from '@/infrastructure/channels/multimodal.service.js';
import { ChannelMediaService } from '@/infrastructure/channels/channel-media.service.js';
import { ChannelType } from '@/generated/prisma/client.js';
import { IncomingMessage } from '@/infrastructure/channels/channel.interface.js';

export interface IncomingMessageJobData {
  channelAccountId: string;
  channelType: ChannelType;
  msg: IncomingMessage;
}

@Processor(QUEUES.INCOMING_MESSAGE)
export class IncomingMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(IncomingMessageProcessor.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly multimodal: MultimodalService,
    private readonly channelMedia: ChannelMediaService,
  ) {
    super();
  }

  async process(job: Job<IncomingMessageJobData>): Promise<void> {
    const { channelAccountId, channelType, msg } = job.data;

    this.logger.debug(
      `[job:${job.id}] Procesando mensaje ${msg.externalId} — canal: ${channelType}`,
    );

    // Normalizar el mensaje a texto antes de enviarlo al LLM
    // El LLM siempre recibe texto — MultimodalService garantiza esto
    // Ref: .claude/modules/chatia-backend/multimodal-adapters.md
    // WhatsApp trae solo el id del medio: se resuelve a URL + Bearer antes de normalizar
    const { organizationId, media } = await this.channelMedia.resolve(
      channelAccountId,
      channelType,
      msg,
    );
    const normalized = await this.multimodal.normalize(
      msg,
      organizationId,
      media,
    );
    const normalizedMsg = { ...msg, content: normalized.text };
    await this.conversations.handleIncomingMessage(
      channelAccountId,
      channelType,
      normalizedMsg,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<IncomingMessageJobData>, error: Error): void {
    this.logger.error(
      `[job:${job.id}] Falló intento ${job.attemptsMade}/${job.opts.attempts} — ` +
        `mensaje: ${job.data.msg.externalId} — error: ${error.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<IncomingMessageJobData>): void {
    this.logger.debug(
      `[job:${job.id}] Completado — mensaje: ${job.data.msg.externalId}`,
    );
  }
}
