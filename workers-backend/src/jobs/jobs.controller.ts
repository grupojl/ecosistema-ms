import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JobsService } from "./jobs.service.js";
@ApiTags("jobs") @Controller("api/v1/jobs")
export class JobsController {
  constructor(private readonly svc: JobsService) {}
  @Get(":jobId/status") status(@Param("jobId") jobId: string) { return this.svc.getJobStatus(jobId); }
}
