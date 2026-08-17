import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { AnalyticsService } from "../analytics.service.js";
import { ANALYTICS_EVENTS_QUEUE } from "../analytics.constants.js";
export interface AnalyticsEventJobData { ecosystemId: string; organizationId: string; eventType: string; payload: Record<string, unknown>; occurredAt: string; }
@Processor(ANALYTICS_EVENTS_QUEUE, { concurrency: parseInt(process.env["ANALYTICS_EVENTS_CONCURRENCY"] ?? "10") })
export class AnalyticsEventProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsEventProcessor.name);
  constructor(private readonly svc: AnalyticsService) { super(); }
  async process(job: Job<AnalyticsEventJobData>) {
    await this.svc.persistEvent({ ecosystemId: job.data.ecosystemId, organizationId: job.data.organizationId, eventType: job.data.eventType, payload: job.data.payload, occurredAt: new Date(job.data.occurredAt) });
  }
  @OnWorkerEvent("failed")
  onFailed(job: Job<AnalyticsEventJobData>, error: Error) { this.logger.error(`Job ${job.id} fallido: ${error.message}`); }
  @OnWorkerEvent("completed")
  onCompleted(job: Job<AnalyticsEventJobData>) { this.logger.debug(`Evento ${job.data.eventType} persistido`); }
}
