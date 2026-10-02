import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation }   from "@nestjs/swagger";
import { OverviewService }         from "@/core/overview/overview.service.js";
import { ZodValidationPipe }       from "@/common/pipes/zod-validation.pipe.js";
import { OverviewQuerySchema, type OverviewQueryInput } from "@/modules/manzana/schemas.js";

@ApiTags("manzana/analytics")
@Controller("api/v1/manzana/analytics")
export class ManzanaController {
  constructor(private readonly overview: OverviewService) {}

  @Get("overview")
  @ApiOperation({ summary: "Resumen ejecutivo — Manzana" })
  overview(@Query(new ZodValidationPipe(OverviewQuerySchema)) q: OverviewQueryInput) {
    return this.overview.getOverview({
      ecosystemId:    q.ecosystemId,
      organizationId: q.organizationId,
      from: new Date(q.from),
      to:   new Date(q.to),
    });
  }

  @Get("conversations/by-day")
  @ApiOperation({ summary: "Conversaciones por día — Manzana" })
  byDay(@Query(new ZodValidationPipe(OverviewQuerySchema)) q: OverviewQueryInput) {
    return this.overview.getConversationsByDay(
      q.organizationId, q.ecosystemId,
      new Date(q.from), new Date(q.to),
    );
  }
}
