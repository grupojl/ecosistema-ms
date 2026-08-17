// chatia-backend/src/analytics/analytics.controller.ts
//
// ADR-003 — DEPRECATED en semana 6.
// Todos los endpoints retornan 410 Gone con URL de migración.
// Eliminar este controller cuando welver complete la migración.

import { Controller, Get, Query, HttpStatus, Res } from '@nestjs/common';
import { ApiTags }                                  from '@nestjs/swagger';
import type { Response }                            from 'express';

const ANALYTICS_URL = process.env['ANALYTICS_BACKEND_URL'] ?? 'https://analytics-backend.railway.app';

@ApiTags('analytics-deprecated')
@Controller('api/v1/analytics')
export class AnalyticsController {
  @Get('overview')
  gone(@Res() res: Response, @Query() q: Record<string, string>): void {
    const params = new URLSearchParams(q).toString();
    res.status(HttpStatus.GONE).json({
      error:      'ENDPOINT_MOVED',
      message:    'Este endpoint fue movido a analytics-backend. Ver migración en ADR-003.',
      migratedTo: `${ANALYTICS_URL}/api/v1/analytics/overview${params ? '?' + params : ''}`,
    });
  }

  @Get('conversations/by-day')
  goneByDay(@Res() res: Response, @Query() q: Record<string, string>): void {
    const params = new URLSearchParams(q).toString();
    res.status(HttpStatus.GONE).json({
      error:      'ENDPOINT_MOVED',
      migratedTo: `${ANALYTICS_URL}/api/v1/analytics/conversations/by-day${params ? '?' + params : ''}`,
    });
  }

  @Get('agents')
  goneAgents(@Res() res: Response, @Query() q: Record<string, string>): void {
    const params = new URLSearchParams(q).toString();
    res.status(HttpStatus.GONE).json({
      error:      'ENDPOINT_MOVED',
      migratedTo: `${ANALYTICS_URL}/api/v1/analytics/agents${params ? '?' + params : ''}`,
    });
  }
}
