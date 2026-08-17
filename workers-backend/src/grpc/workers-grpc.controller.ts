import { Controller, Logger } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { JobsService } from "../jobs/jobs.service.js";
@Controller()
export class WorkersGrpcController {
  private readonly logger = new Logger(WorkersGrpcController.name);
  constructor(private readonly jobs: JobsService) {}
  @GrpcMethod("WorkersService", "GetJobStatus")
  async getJobStatus(data: { job_id:string; queue:string }) {
    const log = await this.jobs.getJobStatus(data.job_id);
    return { job_id: log.jobId, queue: log.queue, status: log.status, attempts: log.attempts, started_at: log.startedAt?.getTime()??0, completed_at: log.completedAt?.getTime()??0, duration_ms: log.durationMs??0, error: log.error??"", result_json: log.result ? Buffer.from(JSON.stringify(log.result)) : Buffer.from("{}") };
  }
  @GrpcMethod("WorkersService", "Ping")
  ping(data: { from:string }) { return { pong: "workers-backend", timestamp_unix: Date.now() }; }
}
