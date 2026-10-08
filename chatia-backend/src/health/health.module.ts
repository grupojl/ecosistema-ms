// chatia-backend/src/health/health.module.ts
import { Module }                from '@nestjs/common';
import { BullModule }            from '@nestjs/bullmq';
import { HealthController }      from '@/health/health.controller.js';
import { PrismaModule }          from '@/infrastructure/prisma/prisma.module.js';
import { CommonModule }          from '@/infrastructure/common/common.module.js';
import { QUEUES }                from '@/queue/queue.constants.js';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    BullModule.registerQueue(
      { name: QUEUES.INCOMING_MESSAGE },
      { name: QUEUES.OUTGOING_MESSAGE },
    ),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
