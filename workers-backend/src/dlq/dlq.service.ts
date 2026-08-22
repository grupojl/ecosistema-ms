// workers-backend/src/dlq/dlq.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue }                           from '@nestjs/bullmq';
import { Queue }                                 from 'bullmq';
import { PrismaService }                         from '../prisma/prisma.service.js';
import { WORKER_QUEUES }                         from '../jobs/jobs.constants.js';

const DLQ_WARN_THRESHOLD = 500;
const DLQ_MAX_THRESHOLD  = 1_000;

export interface DlqJobEntry {
  queue:        string;
  jobId:        string;
  failedReason: string;
  attempts:     number;
  failedAt:     number;
  data:         unknown;
}

export interface QueueStats {
  queue:    string;
  failed:   number;
  warning:  boolean;
  critical: boolean;
}

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    @InjectQueue(WORKER_QUEUES.DLQ_FAQ_INGEST)     private readonly faqDlq:      Queue,
    @InjectQueue(WORKER_QUEUES.DLQ_VECTOR_INDEX)   private readonly vectorDlq:   Queue,
    @InjectQueue(WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL) private readonly campaignDlq: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async listAll(): Promise<DlqJobEntry[]> {
    const results: DlqJobEntry[] = [];

    for (const [queueName, queue] of this.getQueues()) {
      const failed = await queue.getFailed(0, 99);
      for (const job of failed) {
        results.push({
          queue:        queueName,
          jobId:        job.id as string,
          failedReason: job.failedReason ?? 'unknown',
          attempts:     job.attemptsMade,
          failedAt:     job.finishedOn ?? 0,
          data:         job.data,
        });
      }
    }

    return results.sort((a, b) => b.failedAt - a.failedAt);
  }

  async retryJob(queueName: string, jobId: string): Promise<{ success: boolean }> {
    const queue = this.resolveQueue(queueName);
    const job   = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} no encontrado en ${queueName}`);

    await job.retry('failed');
    this.logger.log(`DLQ retry: job ${jobId} en ${queueName}`);

    await this.prisma.jobLog.updateMany({
      where: { jobId },
      data:  { status: 'PENDING', error: null },
    });

    return { success: true };
  }

  async discardJob(queueName: string, jobId: string): Promise<{ success: boolean }> {
    const queue = this.resolveQueue(queueName);
    const job   = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} no encontrado en ${queueName}`);

    await job.remove();
    this.logger.log(`DLQ discard: job ${jobId} eliminado de ${queueName}`);

    await this.prisma.jobLog.updateMany({
      where: { jobId },
      data:  { status: 'CANCELLED', error: 'Descartado manualmente desde DLQ' },
    });

    return { success: true };
  }

  async getStats(): Promise<{ queues: QueueStats[]; totalFailed: number; healthy: boolean }> {
    const stats: QueueStats[] = [];
    let totalFailed = 0;

    for (const [queueName, queue] of this.getQueues()) {
      const failed  = await queue.getFailedCount();
      totalFailed  += failed;

      if (failed >= DLQ_WARN_THRESHOLD) {
        this.logger.warn(`DLQ ${queueName}: ${failed} jobs fallidos`);
      }
      if (failed >= DLQ_MAX_THRESHOLD) {
        this.logger.error(`DLQ ${queueName}: ${failed} jobs — CRÍTICO`);
      }

      stats.push({
        queue:    queueName,
        failed,
        warning:  failed >= DLQ_WARN_THRESHOLD,
        critical: failed >= DLQ_MAX_THRESHOLD,
      });
    }

    return { queues: stats, totalFailed, healthy: totalFailed < DLQ_WARN_THRESHOLD };
  }

  private getQueues(): Array<[string, Queue]> {
    return [
      [WORKER_QUEUES.DLQ_FAQ_INGEST,     this.faqDlq],
      [WORKER_QUEUES.DLQ_VECTOR_INDEX,   this.vectorDlq],
      [WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL, this.campaignDlq],
    ];
  }

  private resolveQueue(queueName: string): Queue {
    const map: Record<string, Queue> = {
      [WORKER_QUEUES.DLQ_FAQ_INGEST]:     this.faqDlq,
      [WORKER_QUEUES.DLQ_VECTOR_INDEX]:   this.vectorDlq,
      [WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL]: this.campaignDlq,
    };
    const queue = map[queueName];
    if (!queue) throw new NotFoundException(`Queue ${queueName} no existe en DLQ`);
    return queue;
  }
}
