// chatia-backend/src/infrastructure/queue/dlq/dlq.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DlqService } from '@/infrastructure/queue/dlq/dlq.service.js';
import { DlqController } from '@/infrastructure/queue/dlq/dlq.controller.js';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.INCOMING_MESSAGE },
      { name: QUEUES.OUTGOING_MESSAGE },
    ),
  ],
  providers: [DlqService],
  controllers: [DlqController],
  exports: [DlqService],
})
export class DlqModule {}
