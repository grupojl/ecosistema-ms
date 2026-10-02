// pasarelapagos-backend/src/modules/mexus/mexus.controller.ts
// Endpoints HTTP de pagos para el ecosistema Mexus
// Consume del core/ — no tiene lógica de dominio propia
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";

@ApiTags("mexus/payments")
@ApiBearerAuth()
@Controller("api/v1/mexus/payments")
export class MexusController {
  @Get("ping")
  ping() { return { ecosystemId: "mexus", status: "ok" }; }
}
