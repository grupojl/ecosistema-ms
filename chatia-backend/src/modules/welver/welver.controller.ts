// chatia-backend/src/modules/welver/welver.controller.ts
// Endpoints HTTP específicos de Welver
// Consume del core/ — no tiene lógica de dominio propia
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";
import { TenantGuard }                from "@/infrastructure/common/guards/tenant.guard.js";
import { Tenant }                     from "@/infrastructure/common/decorators/tenant.decorator.js";
import type { TenantContext }         from "@/infrastructure/common/types/tenant-context.js";

@ApiTags("welver")
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller("api/v1/welver")
export class WelverController {
  @Get("ping")
  ping(@Tenant() tenant: TenantContext) {
    return { ecosystemId: tenant.ecosystemId, status: "ok" };
  }
}
