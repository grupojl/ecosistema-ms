import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { JobsService } from "../jobs.service.js";
import { WORKER_QUEUES } from "../jobs.constants.js";
export interface FaqIngestJobData {
  ecosystemId: string; organizationId: string; documentId: string;
  sourceUrl?: string; base64Content?: string; mimeType: string;
  chunkSize: number; chunkOverlap: number; embeddingModel: string;
}
@Processor(WORKER_QUEUES.FAQ_INGEST, { concurrency: parseInt(process.env["WORKERS_FAQ_INGEST_CONCURRENCY"] ?? "3") })
export class FaqIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(FaqIngestProcessor.name);
  constructor(private readonly jobs: JobsService) { super(); }
  async process(job: Job<FaqIngestJobData>): Promise<void> {
    const startedAt = new Date();
    await this.jobs.updateJobLog(job.id!, { status: "PROCESSING", startedAt, attempts: job.attemptsMade + 1 });
    try {
      // TODO Sprint W-2: implementar extraccion real (pdf-parse, mammoth, Groq embeddings)
      this.logger.log(`[STUB] FaqIngest doc ${job.data.documentId}`);
      const completedAt = new Date();
      await this.jobs.updateJobLog(job.id!, { status: "DONE", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), result: { documentId: job.data.documentId, chunksProcessed: 0 } });
    } catch (err) {
      await this.jobs.updateJobLog(job.id!, { status: "FAILED", error: (err as Error).message });
      throw err;
    }
  }
  @OnWorkerEvent("failed")
  onFailed(job: Job<FaqIngestJobData>, error: Error) { this.logger.error(`Job ${job.id} fallido: ${error.message}`); }
}
