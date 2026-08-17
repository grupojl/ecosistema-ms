// workers-backend/src/dlq/dlq.controller.ts
import {
  Controller, Get, Post, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DlqService } from './dlq.service.js';

@ApiTags('dlq')
@ApiBearerAuth()
@Controller('api/v1/dlq')
export class DlqController {
  constructor(private readonly svc: DlqService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los jobs fallidos en DLQ' })
  listAll() { return this.svc.listAll(); }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas y health de la DLQ' })
  stats() { return this.svc.getStats(); }

  @Post(':queue/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-encolar un job fallido' })
  retry(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    return this.svc.retryJob(queue, jobId);
  }

  @Post(':queue/:jobId/discard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Descartar y archivar un job fallido' })
  discard(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    return this.svc.discardJob(queue, jobId);
  }
}
