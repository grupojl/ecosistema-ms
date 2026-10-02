// marketing-backend/src/modules/mexus/mexus.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";
import { CampaignsService }           from "@/core/campaigns/campaigns.service.js";

@ApiTags("mexus/marketing")
@ApiBearerAuth()
@Controller("api/v1/mexus/marketing")
export class MexusController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get("ping")
  ping() { return { ecosystemId: "mexus", status: "ok" }; }
}
