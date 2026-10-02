import { Module }         from "@nestjs/common";
import { JobsController } from "@/jobs/jobs.controller.js";
import { JobsModule as CoreJobsModule } from "@/core/jobs/jobs.module.js";

@Module({
  imports:     [CoreJobsModule],
  controllers: [JobsController],
})
export class JobsModule {}
