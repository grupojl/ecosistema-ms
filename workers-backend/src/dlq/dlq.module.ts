// workers-backend/src/dlq/dlq.module.ts
import { Module }          from '@nestjs/common';
import { BullModule }      from '@nestjs/bullmq';
import { WORKER_QUEUES }   from '../jobs/jobs.constants.js';
import { DlqController }   from './dlq.controller.js';
import { DlqService }      from './dlq.service.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: WORKER_QUEUES.DLQ_FAQ_INGEST },
      { name: WORKER_QUEUES.DLQ_VECTOR_INDEX },
      { name: WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL },
    ),
  ],
  controllers: [DlqController],
  providers:   [DlqService],
  exports:     [DlqService],
})
export class DlqModule {}
