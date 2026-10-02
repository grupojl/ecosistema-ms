// pasarelapagos-backend/src/modules/manzana/manzana.controller.ts
// Endpoints HTTP de pagos para el ecosistema Manzana
// Consume del core/ — no tiene lógica de dominio propia
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";

@ApiTags("manzana/payments")
@ApiBearerAuth()
@Controller("api/v1/manzana/payments")
export class ManzanaController {
  @Get("ping")
  ping() { return { ecosystemId: "manzana", status: "ok" }; }
}
