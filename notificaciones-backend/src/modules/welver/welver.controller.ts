// notificaciones-backend/src/modules/welver/welver.controller.ts
import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }                  from "@nestjs/swagger";
import { NotificationsService }  from "@/core/notifications/notifications.service.js";
import { PreferencesService }    from "@/core/preferences/preferences.service.js";

@ApiTags("welver/notifications")
@ApiBearerAuth()
@Controller("api/v1/welver/notifications")
export class WelverController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences:   PreferencesService,
  ) {}

  @Get("ping")
  ping() { return { ecosystemId: "welver", status: "ok" }; }
}
