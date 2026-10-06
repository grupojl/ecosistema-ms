import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue }                     from '@nestjs/bullmq';
import { Queue }                           from 'bullmq';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    @Optional() @InjectQueue('document-ingestion') private readonly ingestQueue: Queue | null,
    @Optional() @InjectQueue('email-campaigns')    private readonly emailQueue:  Queue | null,
  ) {}

  async getHealth() {
    const [ingestCounts, emailCounts] = await Promise.all([
      this.ingestQueue?.getJobCounts() ?? null,
      this.emailQueue?.getJobCounts()  ?? null,
    ]);

    const queues: Record<string, unknown> = {};

    if (ingestCounts) {
      queues['document-ingestion'] = {
        waiting: ingestCounts.waiting ?? 0,
        active:  ingestCounts.active  ?? 0,
        failed:  ingestCounts.failed  ?? 0,
      };
    }

    if (emailCounts) {
      queues['email-campaigns'] = {
        waiting: emailCounts.waiting ?? 0,
        active:  emailCounts.active  ?? 0,
        failed:  emailCounts.failed  ?? 0,
      };
    }

    const hasDegradation = Object.values(queues).some(
      (q) => (q as { failed: number }).failed > 10,
    );

    return {
      status: hasDegradation ? ('degraded' as const) : ('ok' as const),
      queues,
      uptime: Math.floor(process.uptime()),
    };
  }
}
