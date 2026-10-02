// notificaciones-backend/src/queue/queue.module.ts
import { Module }               from "@nestjs/common";
import { BullModule }           from "@nestjs/bullmq";
import { NotificationProcessor } from "@/queue/notification.processor.js";
import { DlqModule }            from "@/queue/dlq/dlq.module.js";
import { NOTIFICATIONS_QUEUE }  from "@/core/notifications/notifications.constants.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
    DlqModule,
  ],
  providers: [NotificationProcessor],
})
export class QueueModule {}
