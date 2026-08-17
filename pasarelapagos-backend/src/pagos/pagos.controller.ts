import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { ApiTags, ApiOperation }              from "@nestjs/swagger";
import { PagosService }                       from "./pagos.service";

@ApiTags("pagos")
@Controller("api/v1/pagos")
export class PagosController {
  constructor(private readonly svc: PagosService) {}

  @Get("health")
  @ApiOperation({ summary: "Health check HTTP del módulo de pagos" })
  health() {
    return { status: "ok" };
  }

  // TODO: endpoints REST autenticados
}
