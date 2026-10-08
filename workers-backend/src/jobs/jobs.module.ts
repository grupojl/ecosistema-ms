import { Module }                       from "@nestjs/common";
import { JobsModule as CoreJobsModule } from "@/core/jobs/jobs.module.js";

// El módulo core es dueño del controller, los processors y las colas (sin duplicados).
@Module({
  imports: [CoreJobsModule],
  exports: [CoreJobsModule],
})
export class JobsModule {}
