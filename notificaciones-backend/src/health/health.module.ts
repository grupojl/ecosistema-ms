// notificaciones-backend/src/health/health.module.ts
import { Module }           from '@nestjs/common';
import { HealthController } from '@/health/health.controller.js';
import { PrismaModule }     from '@/prisma/prisma.module.js';
import { NotificationsModule } from '@/notifications/notifications.module.js';
import { DlqModule }        from '@/notifications/dlq/dlq.module.js';

@Module({
  imports:     [PrismaModule, NotificationsModule, DlqModule],
  controllers: [HealthController],
})
export class HealthModule {}
