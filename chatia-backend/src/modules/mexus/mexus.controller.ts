// chatia-backend/src/modules/mexus/mexus.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";
import { TenantGuard }                from "@/infrastructure/common/guards/tenant.guard.js";
import { Tenant }                     from "@/infrastructure/common/decorators/tenant.decorator.js";
import type { TenantContext }         from "@/infrastructure/common/types/tenant-context.js";

@ApiTags("mexus")
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller("api/v1/mexus")
export class MexusController {
  @Get("ping")
  ping(@Tenant() tenant: TenantContext) {
    return { ecosystemId: tenant.ecosystemId, status: "ok" };
  }
}
