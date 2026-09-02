// analytics-backend/src/analytics/analytics.controller.ts
//
// A-2.4: API completa.
// GET  /analytics/overview
// GET  /analytics/conversations/by-day
// GET  /analytics/agents
// POST /analytics/export          → async, retorna jobId para workers-backend
// GET  /analytics/export/:jobId/status
import {
  Controller, Get, Post, Param,
  Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ExportSchema, type ExportInput } from './schemas.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiResponse, ApiQuery, ApiBody,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service.js';
import { ExportService }    from './export.service.js';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(
    private readonly svc:    AnalyticsService,
    private readonly export_: ExportService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Resumen ejecutivo del período' })
  @ApiQuery({ name: 'ecosystemId',    required: true })
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'from',           required: true, description: 'ISO date' })
  @ApiQuery({ name: 'to',             required: true, description: 'ISO date' })
  overview(
    @Query('ecosystemId')    ecosystemId:    string,
    @Query('organizationId') organizationId: string,
    @Query('from')           from:           string,
    @Query('to')             to:             string,
  ) {
    return this.svc.getOverview({
      ecosystemId, organizationId,
      from: new Date(from), to: new Date(to),
    });
  }

  @Get('conversations/by-day')
  @ApiOperation({ summary: 'Conversaciones agrupadas por día' })
  @ApiQuery({ name: 'ecosystemId',    required: true })
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'from',           required: true, description: 'ISO date' })
  @ApiQuery({ name: 'to',             required: true, description: 'ISO date' })
  byDay(
    @Query('ecosystemId')    ecosystemId:    string,
    @Query('organizationId') organizationId: string,
    @Query('from')           from:           string,
    @Query('to')             to:             string,
  ) {
    return this.svc.getConversationsByDay(
      organizationId,
      ecosystemId,
      new Date(from),
      new Date(to),
    );
  }

  @Get('agents')
  @ApiOperation({ summary: 'Métricas de agentes (top 20 por defecto)' })
  @ApiQuery({ name: 'page',  required: false })
  @ApiQuery({ name: 'limit', required: false })
  agentMetrics(
    @Query('ecosystemId')    ecosystemId:    string,
    @Query('organizationId') organizationId: string,
    @Query('from')           from:           string,
    @Query('to')             to:             string,
    @Query('page')           page?:          string,
    @Query('limit')          limit?:         string,
  ) {
    return this.svc.getAgentMetrics({
      ecosystemId, organizationId,
      from:  new Date(from), to: new Date(to),
      page:  page  ? parseInt(page,  10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  // ── Export async ──────────────────────────────────────────────────────────
  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Iniciar exportación async — retorna jobId' })
  @ApiResponse({ status: 202, description: 'Exportación encolada' })
  startExport(@Body(new ZodValidationPipe(ExportSchema)) dto: ExportInput) {
    return this.export_.enqueue({
      ecosystemId:    dto.ecosystemId,
      organizationId: dto.organizationId,
      from:           new Date(dto.from),
      to:             new Date(dto.to),
      format:         dto.format,
      reportType:     dto.reportType,
    });
  }

  @Get('export/:jobId/status')
  @ApiOperation({ summary: 'Estado de una exportación async' })
  exportStatus(@Param('jobId') jobId: string) {
    return this.export_.getStatus(jobId);
  }
}
