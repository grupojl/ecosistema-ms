// analytics-backend/src/analytics/export.service.ts
//
// A-2.4: Exportación async via workers-backend.
// analytics-backend encola el job — workers-backend genera el archivo.
// El resultado (URL firmada) queda en JobLog de workers-backend.

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue }        from '@nestjs/bullmq';
import { Queue }              from 'bullmq';

const ANALYTICS_EXPORT_QUEUE = 'workers.analytics-export';

export interface ExportJobData {
  ecosystemId:    string;
  organizationId: string;
  from:           Date;
  to:             Date;
  format:         'csv' | 'json';
  reportType:     string;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectQueue(ANALYTICS_EXPORT_QUEUE) private readonly exportQueue: Queue<ExportJobData>,
  ) {}

  async enqueue(data: ExportJobData): Promise<{ jobId: string; status: 'PENDING' }> {
    const job = await this.exportQueue.add('analytics.export', data, {
      attempts:         3,
      backoff:          { type: 'exponential', delay: 5_000 },
      removeOnComplete: 50,
      removeOnFail:     50,
    });

    this.logger.log(
      `Export encolado [${job.id}] org:${data.organizationId} format:${data.format}`,
    );

    return { jobId: job.id as string, status: 'PENDING' };
  }

  async getStatus(jobId: string): Promise<{
    jobId: string;
    status: string;
    resultUrl?: string;
    error?: string;
  }> {
    const job = await this.exportQueue.getJob(jobId);

    if (!job) {
      return { jobId, status: 'NOT_FOUND' };
    }

    const state = await job.getState();

    return {
      jobId,
      status:    state.toUpperCase(),
      resultUrl: (job.returnvalue as { url?: string } | undefined)?.url,
      error:     job.failedReason,
    };
  }
}
