// notificaciones-backend/src/notifications/notifications.controller.ts
//
// N-3.2: HTTP API completa.
// POST /notifications              → enqueue manual (desde welver o chatia)
// GET  /notifications/:id/status  → estado de una notificación
// GET  /notifications/stats       → tasa de entrega por canal y período
import {
  Controller, Post, Get, Param, Body,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { EnqueueNotificationSchema, type EnqueueNotificationInput } from './schemas.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiResponse, ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Encolar una notificación para envío asíncrono' })
  @ApiResponse({ status: 202, description: 'Job encolado' })
  enqueue(@Body(new ZodValidationPipe(EnqueueNotificationSchema)) dto: EnqueueNotificationInput) {
    return this.svc.enqueue(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Tasa de entrega por canal en un período' })
  @ApiQuery({ name: 'ecosystemId',    required: true })
  @ApiQuery({ name: 'organizationId', required: true })
  @ApiQuery({ name: 'from',           required: true, description: 'ISO date' })
  @ApiQuery({ name: 'to',             required: true, description: 'ISO date' })
  @ApiQuery({ name: 'channel',        required: false, enum: ['WHATSAPP', 'EMAIL', 'PUSH'] })
  stats(
    @Query('ecosystemId')    ecosystemId:    string,
    @Query('organizationId') organizationId: string,
    @Query('from')           from:           string,
    @Query('to')             to:             string,
    @Query('channel')        channel?:       string,
  ) {
    return this.svc.getStats({
      ecosystemId,
      organizationId,
      from:    new Date(from),
      to:      new Date(to),
      channel: channel as 'WHATSAPP' | 'EMAIL' | 'PUSH' | undefined,
    });
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Estado de una notificación por ID' })
  status(@Param('id') id: string) {
    return this.svc.getStatus(id);
  }
}
