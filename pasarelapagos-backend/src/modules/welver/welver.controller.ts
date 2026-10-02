// pasarelapagos-backend/src/modules/welver/welver.controller.ts
// Endpoints HTTP de pagos para el ecosistema Welver
// Consume del core/ — no tiene lógica de dominio propia
import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth }     from "@nestjs/swagger";

@ApiTags("welver/payments")
@ApiBearerAuth()
@Controller("api/v1/welver/payments")
export class WelverController {
  @Get("ping")
  ping() { return { ecosystemId: "welver", status: "ok" }; }
}
