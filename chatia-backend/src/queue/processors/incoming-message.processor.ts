// src/queue/processors/incoming-message.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, JOBS } from '../queue.constants';
import { ConversationsService } from '../../conversations/conversations.service';
import { MultimodalService } from '../../channels/multimodal.service.js';
import { ChannelType } from '@prisma/client';
import { IncomingMessage } from '../../channels/channel.interface';

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
    private readonly multimodal:    MultimodalService,
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
    const normalized = await this.multimodal.normalize(msg, '');
    const normalizedMsg = { ...msg, content: normalized.text };
    await this.conversations.handleIncomingMessage(channelAccountId, channelType, normalizedMsg);
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
