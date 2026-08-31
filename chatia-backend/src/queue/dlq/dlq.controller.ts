// chatia-backend/src/queue/dlq/dlq.controller.ts
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation }    from '@nestjs/swagger';
import { DlqService }                              from './dlq.service.js';
import { TenantGuard }                             from '../../common/guards/tenant.guard.js';
import { RolesGuard }                              from '../../common/guards/roles.guard.js';
import { Roles }                                   from '../../common/decorators/roles.decorator.js';

@ApiTags('dlq')
@ApiBearerAuth()
@UseGuards(TenantGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
@Controller('api/v1/dlq')
export class DlqController {
  constructor(private readonly dlq: DlqService) {}

  @Get()
  @ApiOperation({ summary: 'Estado de la DLQ de mensajes de chatia' })
  getStats() {
    return this.dlq.getStats();
  }

  @Post(':queue/retry/:jobId')
  @ApiOperation({ summary: 'Reintentar un job fallido especifico' })
  retryJob(
    @Param('queue') queue: 'incoming' | 'outgoing',
    @Param('jobId') jobId: string,
  ) {
    return this.dlq.retryJob(queue, jobId);
  }

  @Post(':queue/retry-all')
  @ApiOperation({ summary: 'Reintentar todos los jobs fallidos de una queue' })
  retryAll(@Param('queue') queue: 'incoming' | 'outgoing') {
    return this.dlq.retryAll(queue);
  }
}
