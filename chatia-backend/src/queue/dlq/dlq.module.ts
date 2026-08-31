// chatia-backend/src/queue/dlq/dlq.module.ts
import { Module }      from '@nestjs/common';
import { BullModule }  from '@nestjs/bullmq';
import { DlqService }  from './dlq.service.js';
import { DlqController } from './dlq.controller.js';
import { QUEUES }      from '../queue.constants.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.INCOMING_MESSAGES },
      { name: QUEUES.OUTGOING_MESSAGES },
    ),
  ],
  providers:   [DlqService],
  controllers: [DlqController],
  exports:     [DlqService],
})
export class DlqModule {}
