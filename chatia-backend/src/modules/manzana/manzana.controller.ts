// chatia-backend/src/modules/manzana/manzana.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";
import { TenantGuard }                from "@/infrastructure/common/guards/tenant.guard.js";
import { Tenant }                     from "@/infrastructure/common/decorators/tenant.decorator.js";
import type { TenantContext }         from "@/infrastructure/common/types/tenant-context.js";

@ApiTags("manzana")
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller("api/v1/manzana")
export class ManzanaController {
  @Get("ping")
  ping(@Tenant() tenant: TenantContext) {
    return { ecosystemId: tenant.ecosystemId, status: "ok" };
  }
}
