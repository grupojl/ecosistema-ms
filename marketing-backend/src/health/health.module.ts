import { Module }           from '@nestjs/common';
import { BullModule }       from '@nestjs/bullmq';
import { HealthController } from '@/health/health.controller.js';
import { MARKETING_QUEUES } from '@/marketing.constants.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: MARKETING_QUEUES.CAMPAIGN_SYNC },
      { name: MARKETING_QUEUES.CAMPAIGN_AUTOMATION },
      { name: MARKETING_QUEUES.MARKETING_ATTRIBUTION },
    ),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
