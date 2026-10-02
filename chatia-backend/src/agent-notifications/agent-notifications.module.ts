import { Module }                       from "@nestjs/common";
import { AgentNotificationsController } from "@/agent-notifications/agent-notifications.controller.js";
import { NotificationsModule }          from "@/core/notifications/notifications.module.js";

@Module({
  imports:     [NotificationsModule],
  controllers: [AgentNotificationsController],
})
export class AgentNotificationsModule {}
