// marketing-backend/src/modules/welver/welver.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";
import { CampaignsService }           from "@/core/campaigns/campaigns.service.js";

@ApiTags("welver/marketing")
@ApiBearerAuth()
@Controller("api/v1/welver/marketing")
export class WelverController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get("ping")
  ping() { return { ecosystemId: "welver", status: "ok" }; }
}
