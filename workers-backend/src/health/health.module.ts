// workers-backend/src/health/health.module.ts
import { Module }             from '@nestjs/common';
import { BullModule }         from '@nestjs/bullmq';
import { HealthController }   from './health.controller.js';
import { PrismaModule }       from '../prisma/prisma.module.js';
import { JobsModule }         from '../jobs/jobs.module.js';
import { WORKER_QUEUES }      from '../jobs/jobs.constants.js';

@Module({
  imports: [
    PrismaModule,
    JobsModule,
    BullModule.registerQueue(
      { name: WORKER_QUEUES.FAQ_INGEST },
      { name: WORKER_QUEUES.VECTOR_INDEX },
      { name: WORKER_QUEUES.CAMPAIGN_EMAIL },
    ),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
