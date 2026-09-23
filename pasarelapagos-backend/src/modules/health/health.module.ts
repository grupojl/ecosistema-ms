// pasarelapagos-backend/src/modules/health/health.module.ts
import { Module }          from '@nestjs/common';
import { BullModule }      from '@nestjs/bullmq';
import { HealthController } from '@/modules/health/health.controller.js';
import { ProvidersModule } from '@/providers/providers.module.js';
import { QUEUE_WEBHOOKS, QUEUE_RECONCILE, QUEUE_DLQ } from '@/common/constants/queues.js';

@Module({
  imports: [
    ProvidersModule,
    BullModule.registerQueue(
      { name: QUEUE_WEBHOOKS },
      { name: QUEUE_RECONCILE },
      { name: QUEUE_DLQ },
    ),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
