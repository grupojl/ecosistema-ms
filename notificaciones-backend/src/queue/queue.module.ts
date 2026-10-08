// notificaciones-backend/src/queue/queue.module.ts
// Las colas de canal y sus processors los registra NotificationsModule (core).
// Este módulo expone solo la DLQ + su monitor.
import { Module }    from "@nestjs/common";
import { DlqModule } from "@/queue/dlq/dlq.module.js";

@Module({
  imports: [DlqModule],
  exports: [DlqModule],
})
export class QueueModule {}
