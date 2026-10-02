// notificaciones-backend/src/modules/manzana/manzana.controller.ts
import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }                  from "@nestjs/swagger";
import { NotificationsService }  from "@/core/notifications/notifications.service.js";
import { PreferencesService }    from "@/core/preferences/preferences.service.js";

@ApiTags("manzana/notifications")
@ApiBearerAuth()
@Controller("api/v1/manzana/notifications")
export class ManzanaController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences:   PreferencesService,
  ) {}

  @Get("ping")
  ping() { return { ecosystemId: "manzana", status: "ok" }; }
}
