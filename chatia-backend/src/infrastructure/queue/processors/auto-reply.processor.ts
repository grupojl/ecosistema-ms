// src/infrastructure/queue/processors/auto-reply.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';
import {
  AutoReplyService,
  type AutoReplyJobData,
  type AutoReplyOutcome,
} from '@/core/conversations/auto-reply.service.js';

@Processor(QUEUES.AUTO_REPLY)
export class AutoReplyProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoReplyProcessor.name);

  constructor(private readonly autoReply: AutoReplyService) {
    super();
  }

  process(job: Job<AutoReplyJobData>): Promise<AutoReplyOutcome> {
    return this.autoReply.reply(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AutoReplyJobData> | undefined, error: Error): void {
    this.logger.error(
      `[job:${job?.id}] Falló respuesta automática (intento ${job?.attemptsMade}/${job?.opts.attempts}) ` +
        `conv ${job?.data.conversationId}: ${error.message}`,
    );
  }
}
