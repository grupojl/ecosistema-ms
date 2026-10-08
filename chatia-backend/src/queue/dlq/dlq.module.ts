// chatia-backend/src/queue/dlq/dlq.module.ts
import { Module }      from '@nestjs/common';
import { BullModule }  from '@nestjs/bullmq';
import { DlqService }  from '@/queue/dlq/dlq.service.js';
import { DlqController } from '@/queue/dlq/dlq.controller.js';
import { QUEUES }      from '@/queue/queue.constants.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.INCOMING_MESSAGE },
      { name: QUEUES.OUTGOING_MESSAGE },
    ),
  ],
  providers:   [DlqService],
  controllers: [DlqController],
  exports:     [DlqService],
})
export class DlqModule {}
