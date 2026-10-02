// notificaciones-backend/src/modules/mexus/mexus.controller.ts
import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }                  from "@nestjs/swagger";
import { NotificationsService }  from "@/core/notifications/notifications.service.js";
import { PreferencesService }    from "@/core/preferences/preferences.service.js";

@ApiTags("mexus/notifications")
@ApiBearerAuth()
@Controller("api/v1/mexus/notifications")
export class MexusController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences:   PreferencesService,
  ) {}

  @Get("ping")
  ping() { return { ecosystemId: "mexus", status: "ok" }; }
}
