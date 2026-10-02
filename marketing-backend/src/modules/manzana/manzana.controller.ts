// marketing-backend/src/modules/manzana/manzana.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";
import { CampaignsService }           from "@/core/campaigns/campaigns.service.js";

@ApiTags("manzana/marketing")
@ApiBearerAuth()
@Controller("api/v1/manzana/marketing")
export class ManzanaController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get("ping")
  ping() { return { ecosystemId: "manzana", status: "ok" }; }
}
