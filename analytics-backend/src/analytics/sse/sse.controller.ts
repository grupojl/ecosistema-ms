// analytics-backend/src/analytics/sse/sse.controller.ts
//
// GET /api/v1/analytics/live?organizationId=&ecosystemId=
// Retorna un stream SSE con eventos en tiempo real de la organización.

import {
  Controller, Get, Query, Req, Res, OnModuleDestroy,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request, Response }               from 'express';
import { SseService }                           from './sse.service.js';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('api/v1/analytics')
export class SseController implements OnModuleDestroy {
  constructor(private readonly sse: SseService) {}

  onModuleDestroy(): void {
    // SseService ya maneja cleanup en onModuleDestroy
  }

  @Get('live')
  @ApiOperation({ summary: 'Stream SSE de eventos en tiempo real (conversaciones, mensajes)' })
  stream(
    @Query('organizationId') organizationId: string,
    @Query('ecosystemId')    _ecosystemId:    string,
    @Req()  req: Request,
    @Res()  res: Response,
  ): void {
    const clientId = this.sse.addClient(organizationId, res);
    if (!clientId) return;

    // Limpiar cuando el cliente cierre la conexión
    req.on('close',   () => this.sse.removeClient(clientId));
    req.on('aborted', () => this.sse.removeClient(clientId));
  }

  @Get('live/stats')
  @ApiOperation({ summary: 'Estadísticas de conexiones SSE activas' })
  sseStats() {
    return { connections: this.sse.getConnectionCount() };
  }
}
