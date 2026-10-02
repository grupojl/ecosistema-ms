// analytics-backend/src/modules/welver/welver.controller.ts
// Endpoints HTTP de analytics para el ecosistema Welver
// Consume del core — no tiene lógica de dominio propia
import {
  Controller, Get, Post, Param,
  Query, Body, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { OverviewService } from "@/core/overview/overview.service.js";
import { ExportService }   from "@/core/export/export.service.js";
import { ZodValidationPipe } from "@/common/pipes/zod-validation.pipe.js";
import {
  OverviewQuerySchema, AgentsQuerySchema, ExportSchema,
  type OverviewQueryInput, type AgentsQueryInput, type ExportInput,
} from "@/modules/welver/schemas.js";

@ApiTags("welver/analytics")
@Controller("api/v1/welver/analytics")
export class WelverController {
  constructor(
    private readonly overview: OverviewService,
    private readonly export_:  ExportService,
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "Resumen ejecutivo — Welver" })
  overview(@Query(new ZodValidationPipe(OverviewQuerySchema)) q: OverviewQueryInput) {
    return this.overview.getOverview({
      ecosystemId:    q.ecosystemId,
      organizationId: q.organizationId,
      from: new Date(q.from),
      to:   new Date(q.to),
    });
  }

  @Get("conversations/by-day")
  @ApiOperation({ summary: "Conversaciones por día — Welver" })
  byDay(@Query(new ZodValidationPipe(OverviewQuerySchema)) q: OverviewQueryInput) {
    return this.overview.getConversationsByDay(
      q.organizationId, q.ecosystemId,
      new Date(q.from), new Date(q.to),
    );
  }

  @Get("agents")
  @ApiOperation({ summary: "Métricas de agentes — Welver" })
  agents(@Query(new ZodValidationPipe(AgentsQuerySchema)) q: AgentsQueryInput) {
    return this.overview.getAgentMetrics({
      ecosystemId:    q.ecosystemId,
      organizationId: q.organizationId,
      from:  new Date(q.from),
      to:    new Date(q.to),
      page:  q.page,
      limit: q.limit,
    });
  }

  @Post("export")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Exportación async — Welver" })
  startExport(@Body(new ZodValidationPipe(ExportSchema)) dto: ExportInput) {
    return this.export_.enqueue({
      ecosystemId:    dto.ecosystemId,
      organizationId: dto.organizationId,
      from:   new Date(dto.from),
      to:     new Date(dto.to),
      format: dto.format,
    });
  }

  @Get("export/:jobId/status")
  exportStatus(@Param("jobId") jobId: string) {
    return this.export_.getStatus(jobId);
  }
}
