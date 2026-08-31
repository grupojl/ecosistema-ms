// chatia-backend/src/queue/dlq/dlq.service.ts
// Monitor y replay de la DLQ de mensajes de chatia.
// ADR-003: jobs criticos (mensajes entrantes/salientes) necesitan DLQ propia.
import { Injectable, Logger }    from '@nestjs/common';
import { InjectQueue }           from '@nestjs/bullmq';
import { Queue }                 from 'bullmq';
import { QUEUES }                from '../queue.constants.js';

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    @InjectQueue(QUEUES.INCOMING_MESSAGES) private readonly incomingQueue: Queue,
    @InjectQueue(QUEUES.OUTGOING_MESSAGES) private readonly outgoingQueue: Queue,
  ) {}

  async getStats() {
    const [inFailed, outFailed] = await Promise.all([
      this.incomingQueue.getFailed(),
      this.outgoingQueue.getFailed(),
    ]);
    return {
      incoming: {
        failed: inFailed.length,
        jobs:   inFailed.slice(0, 10).map(j => ({
          id:         j.id,
          data:       j.data,
          failedReason: j.failedReason,
          attemptsMade: j.attemptsMade,
        })),
      },
      outgoing: {
        failed: outFailed.length,
        jobs:   outFailed.slice(0, 10).map(j => ({
          id:           j.id,
          data:         j.data,
          failedReason: j.failedReason,
          attemptsMade: j.attemptsMade,
        })),
      },
    };
  }

  async retryJob(queue: 'incoming' | 'outgoing', jobId: string) {
    const q = queue === 'incoming' ? this.incomingQueue : this.outgoingQueue;
    const job = await q.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in ${queue} queue`);
    await job.retry('failed');
    this.logger.log({ queue, jobId }, 'job retried manually');
    return { retried: true, jobId };
  }

  async retryAll(queue: 'incoming' | 'outgoing') {
    const q = queue === 'incoming' ? this.incomingQueue : this.outgoingQueue;
    const failed = await q.getFailed();
    const results = await Promise.allSettled(failed.map(j => j.retry('failed')));
    const retried = results.filter(r => r.status === 'fulfilled').length;
    this.logger.log({ queue, retried, total: failed.length }, 'bulk retry completed');
    return { retried, total: failed.length };
  }

  async clearDlq(queue: 'incoming' | 'outgoing') {
    const q = queue === 'incoming' ? this.incomingQueue : this.outgoingQueue;
    await q.clean(0, 1000, 'failed');
    this.logger.warn({ queue }, 'DLQ cleared manually');
    return { cleared: true };
  }
}
