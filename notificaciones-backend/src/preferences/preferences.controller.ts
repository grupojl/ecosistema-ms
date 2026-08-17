import { Controller, Get, Put, Param, Body } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PreferencesService } from "./preferences.service.js";
@ApiTags("preferences") @ApiBearerAuth()
@Controller("api/v1/preferences")
export class PreferencesController {
  constructor(private readonly svc: PreferencesService) {}
  @Get(":contactId")
  get(@Param("contactId") contactId: string, @Body("organizationId") orgId: string) {
    return this.svc.getPreferences(orgId, contactId);
  }
  @Put(":contactId/:channel")
  update(@Param("contactId") contactId: string, @Param("channel") channel: "WHATSAPP"|"EMAIL"|"PUSH",
         @Body() body: { ecosystemId: string; organizationId: string; optedOut: boolean }) {
    return this.svc.upsertPreference(body.ecosystemId, body.organizationId, contactId, channel, body.optedOut);
  }
}
