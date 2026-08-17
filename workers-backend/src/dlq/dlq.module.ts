import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { WORKER_QUEUES } from "../jobs/jobs.constants.js";
import { DlqController } from "./dlq.controller.js";
import { DlqService } from "./dlq.service.js";
@Module({
  imports: [BullModule.registerQueue({ name: WORKER_QUEUES.FAQ_INGEST_DLQ }, { name: WORKER_QUEUES.VECTOR_INDEX_DLQ }, { name: WORKER_QUEUES.CAMPAIGN_EMAIL_DLQ }, { name: WORKER_QUEUES.ANALYTICS_EXPORT_DLQ })],
  controllers: [DlqController],
  providers: [DlqService],
})
export class DlqModule {}
